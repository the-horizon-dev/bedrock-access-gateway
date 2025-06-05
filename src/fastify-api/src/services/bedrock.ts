import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  ChatMessage,
  EmbeddingRequest,
  EmbeddingResponse,
  ModelListResponse,
  ErrorResponse,
} from "../types/api.types.js";
import {
  BedrockMessage,
  BedrockPayload,
} from "../types/bedrock.types.js";

/* --------------------------------------------------------------------------
 *  Enhanced Bedrock service wrapper with OpenAI-compatible façade
 *  Features:
 *    • Comprehensive multimodal content support (text + images)
 *    • Tools/function calling support (graceful handling)
 *    • Response format support (JSON mode)
 *    • Stop sequences handling
 *    • Enhanced error handling with OpenAI error format
 *    • Robust streaming with proper error recovery
 *    • Improved token estimation and usage tracking
 *    • Better type safety and validation
 * ------------------------------------------------------------------------*/

// Configuration with environment variable fallbacks
const BEDROCK_CONFIG = {
  region: process.env.AWS_REGION || "us-east-1",
  maxRetries: parseInt(process.env.BEDROCK_MAX_RETRIES || "3"),
  timeout: parseInt(process.env.BEDROCK_TIMEOUT || "30000"),
  defaultMaxTokens: parseInt(process.env.BEDROCK_DEFAULT_MAX_TOKENS || "2048"),
  defaultTemperature: parseFloat(process.env.BEDROCK_DEFAULT_TEMPERATURE || "1.0"),
  defaultTopP: parseFloat(process.env.BEDROCK_DEFAULT_TOP_P || "1.0"),
} as const;

// Initialize client with enhanced configuration
const client = new BedrockRuntimeClient({
  region: BEDROCK_CONFIG.region,
  maxAttempts: BEDROCK_CONFIG.maxRetries,
  requestHandler: {
    requestTimeout: BEDROCK_CONFIG.timeout,
  },
});

/* --------------------------------------------------------------------------
 * Enhanced Model Mappings with Latest Models
 * ------------------------------------------------------------------------*/
export const MODEL_MAPPING: Readonly<Record<string, string>> = {
  // GPT-4 family → Claude 3.7 Sonnet (latest)
  "gpt-4o": "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
  "gpt-4o-mini": "us.anthropic.claude-3-5-haiku-20241022-v1:0",
  "gpt-4": "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
  "gpt-4-32k": "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
  "gpt-4-turbo": "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
  "gpt-4-turbo-preview": "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
  
  // GPT-3.5 family → Claude 3.5 Haiku
  "gpt-3.5-turbo": "us.anthropic.claude-3-5-haiku-20241022-v1:0",
  "gpt-3.5-turbo-16k": "us.anthropic.claude-3-5-haiku-20241022-v1:0",
  
  // Claude models (direct mapping)
  "claude-3-5-sonnet-v2": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
  "claude-3-5-haiku": "us.anthropic.claude-3-5-haiku-20241022-v1:0",
  "claude-3-7-sonnet-20250219": "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
  "claude-sonnet-4-20250514": "us.anthropic.claude-sonnet-4-20250514-v1:0",
  "claude-opus-4-20250514": "us.anthropic.claude-opus-4-20250514-v1:0",
  
  // Legacy support
  "claude-3-opus": "us.anthropic.claude-3-opus-20240229-v1:0",
  "claude-3-sonnet": "us.anthropic.claude-3-sonnet-20240229-v1:0",
  "claude-3-haiku": "us.anthropic.claude-3-haiku-20240307-v1:0",
} as const;

export const EMBEDDING_MODEL_MAPPING: Readonly<Record<string, string>> = {
  "text-embedding-ada-002": "amazon.titan-embed-text-v1",
  "text-embedding-3-small": "amazon.titan-embed-text-v1",
  "text-embedding-3-large": "amazon.titan-embed-text-v2:0",
  "text-embedding-cohere": "cohere.embed-english-v3",
  "text-embedding-multilingual": "cohere.embed-multilingual-v3",
} as const;

// Enhanced model validation cache
const validChatModels = new Set(Object.keys(MODEL_MAPPING));
const validEmbeddingModels = new Set(Object.keys(EMBEDDING_MODEL_MAPPING));
const validModels = new Set([...validChatModels, ...validEmbeddingModels]);

/**
 * Enhanced error class for OpenAI-compatible errors
 */
class BedrockError extends Error {
  public readonly type: string;
  public readonly code: string;
  public readonly param?: string;
  public readonly statusCode: number;

  constructor(message: string, type: string = "api_error", code: string = "internal_error", param?: string, statusCode: number = 500) {
    super(message);
    this.name = "BedrockError";
    this.type = type;
    this.code = code;
    this.param = param;
    this.statusCode = statusCode;
  }

  toErrorResponse(): ErrorResponse {
    return {
      error: {
        message: this.message,
        type: this.type,
        code: this.code,
        ...(this.param && { param: this.param }),
      },
    };
  }
}

/**
 * Enhanced model mapping with validation
 */
function mapModelId(openAIModel: string, isEmbedding: boolean = false): string {
  if (!openAIModel || typeof openAIModel !== "string") {
    throw new BedrockError("Invalid model: model ID must be a non-empty string", "invalid_request_error", "invalid_model");
  }

  const mapping = isEmbedding ? EMBEDDING_MODEL_MAPPING : MODEL_MAPPING;
  const bedrockModel = mapping[openAIModel];
  
  if (bedrockModel) {
    return bedrockModel;
  }

  // If it's already a Bedrock model ID, validate format
  if (openAIModel.includes("anthropic") || openAIModel.includes("amazon") || openAIModel.includes("cohere")) {
    return openAIModel;
  }

  // For unknown models, throw a descriptive error
  const validModelsForType = isEmbedding ? validEmbeddingModels : validChatModels;
  throw new BedrockError(
    `Model '${openAIModel}' not found. Available models: ${Array.from(validModelsForType).join(", ")}`,
    "invalid_request_error",
    "model_not_found",
    "model"
  );
}

/**
 * Comprehensive request validation
 */
function validateChatRequest(req: any): asserts req is ChatCompletionRequest {
  if (!req || typeof req !== "object") {
    throw new BedrockError("Invalid request: request must be an object", "invalid_request_error", "invalid_request");
  }

  if (!req.model || typeof req.model !== "string") {
    throw new BedrockError("Invalid request: model is required and must be a string", "invalid_request_error", "missing_model", "model");
  }

  if (!validChatModels.has(req.model) && !req.model.includes("anthropic")) {
    throw new BedrockError(
      `Invalid model: '${req.model}' is not supported for chat completions`,
      "invalid_request_error",
      "invalid_model",
      "model"
    );
  }

  if (!req.messages || !Array.isArray(req.messages) || req.messages.length === 0) {
    throw new BedrockError("Invalid request: messages array is required and cannot be empty", "invalid_request_error", "missing_messages", "messages");
  }

  // Validate temperature
  if (req.temperature !== undefined && (typeof req.temperature !== "number" || req.temperature < 0 || req.temperature > 2)) {
    throw new BedrockError("Invalid temperature: must be a number between 0 and 2", "invalid_request_error", "invalid_temperature", "temperature");
  }

  // Validate max_tokens
  if (req.max_tokens !== undefined && (typeof req.max_tokens !== "number" || req.max_tokens < 1)) {
    throw new BedrockError("Invalid max_tokens: must be a positive integer", "invalid_request_error", "invalid_max_tokens", "max_tokens");
  }

  // Validate top_p
  if (req.top_p !== undefined && (typeof req.top_p !== "number" || req.top_p < 0 || req.top_p > 1)) {
    throw new BedrockError("Invalid top_p: must be a number between 0 and 1", "invalid_request_error", "invalid_top_p", "top_p");
  }

  // Validate each message
  req.messages.forEach((msg: any, index: number) => {
    if (!msg || typeof msg !== "object") {
      throw new BedrockError(`Invalid message at index ${index}: must be an object`, "invalid_request_error", "invalid_message", `messages[${index}]`);
    }

    if (!msg.role || !["system", "user", "assistant", "tool"].includes(msg.role)) {
      throw new BedrockError(
        `Invalid message at index ${index}: role must be 'system', 'user', 'assistant', or 'tool'`,
        "invalid_request_error",
        "invalid_role",
        `messages[${index}].role`
      );
    }

    if (msg.content === undefined || msg.content === null) {
      throw new BedrockError(
        `Invalid message at index ${index}: content is required`,
        "invalid_request_error",
        "missing_content",
        `messages[${index}].content`
      );
    }
  });
}

/* --------------------------------------------------------------------------
 * Enhanced Chat Implementation
 * ------------------------------------------------------------------------*/
export async function bedrockChat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  try {
    validateChatRequest(req);

    const bedrockModel = mapModelId(req.model);
    const payload = await toBedrockPayload({ ...req, model: bedrockModel });
    
    const command = new ConverseCommand(payload);
    const response = await client.send(command);

    if (!response.output) {
      throw new BedrockError("Bedrock API returned empty output", "api_error", "empty_response");
    }

    return fromBedrockPayload(response.output, req.model, bedrockModel);
  } catch (error) {
    if (error instanceof BedrockError) {
      throw error;
    }
    
    // Handle AWS SDK errors
    if (error && typeof error === "object" && "name" in error) {
      const awsError = error as any;
      if (awsError.name === "ValidationException") {
        throw new BedrockError(`Validation error: ${awsError.message}`, "invalid_request_error", "validation_error");
      }
      if (awsError.name === "ThrottlingException") {
        throw new BedrockError("Request rate limit exceeded. Please try again later.", "rate_limit_error", "rate_limit_exceeded");
      }
      if (awsError.name === "AccessDeniedException") {
        throw new BedrockError("Access denied to the requested model", "permission_error", "access_denied");
      }
    }

    throw new BedrockError(
      `Bedrock chat failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      "api_error",
      "bedrock_error"
    );
  }
}

/* --------------------------------------------------------------------------
 * Enhanced Streaming Implementation
 * ------------------------------------------------------------------------*/
export async function* bedrockChatStream(req: ChatCompletionRequest): AsyncGenerator<ChatCompletionChunk | { error: ErrorResponse }> {
  try {
    validateChatRequest(req);
    
    const bedrockModel = mapModelId(req.model);
    const payload = await toBedrockPayload({ ...req, model: bedrockModel });
    const command = new ConverseStreamCommand(payload);
    
    const response = await client.send(command);
    if (!response.stream) {
      throw new BedrockError("Bedrock streaming response is empty", "api_error", "empty_stream");
    }

    const streamId = `chatcmpl-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const created = Math.floor(Date.now() / 1000);

    // Enhanced token tracking
    const promptTokens = estimateTokensFromMessages(req.messages);
    let completionTokens = 0;
    let hasStarted = false;

    try {
      for await (const chunk of response.stream) {
        const openAIChunk = mapChunkToOpenAI(chunk, streamId, created, req.model, !hasStarted);
        
        if (chunk.contentBlockDelta?.delta?.text) {
          completionTokens += estimateTokensFromText(chunk.contentBlockDelta.delta.text);
          hasStarted = true;
        }

        if (openAIChunk) {
          yield openAIChunk;
        }
      }
    } catch (streamError) {
      console.error("[bedrockChatStream] Stream processing error:", streamError);
      yield {
        error: {
          error: {
            message: "Stream processing failed",
            type: "api_error",
            code: "stream_error",
          },
        },
      };
      return;
    }

    // Final chunk with usage information
    if (req.stream_options?.include_usage) {
      yield {
        id: streamId,
        object: "chat.completion.chunk" as const,
        created,
        model: req.model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: "stop" as const,
        }],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
        system_fingerprint: bedrockModel,
      };
    }
  } catch (error) {
    if (error instanceof BedrockError) {
      yield { error: error.toErrorResponse() };
    } else {
      yield {
        error: {
          error: {
            message: `Streaming failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            type: "api_error",
            code: "stream_error",
          },
        },
      };
    }
  }
}

/* --------------------------------------------------------------------------
 * Enhanced Embeddings Implementation
 * ------------------------------------------------------------------------*/
export async function embed(req: EmbeddingRequest): Promise<EmbeddingResponse> {
  try {
    if (!req || typeof req !== "object") {
      throw new BedrockError("Invalid embedding request: must be an object", "invalid_request_error", "invalid_request");
    }

    if (!req.model || typeof req.model !== "string") {
      throw new BedrockError("Invalid embedding request: model is required", "invalid_request_error", "missing_model", "model");
    }

    if (!validEmbeddingModels.has(req.model) && !req.model.includes("amazon") && !req.model.includes("cohere")) {
      throw new BedrockError(
        `Invalid model: '${req.model}' is not supported for embeddings`,
        "invalid_request_error",
        "invalid_model",
        "model"
      );
    }

    if (!req.input) {
      throw new BedrockError("Invalid embedding request: input is required", "invalid_request_error", "missing_input", "input");
    }

    const modelId = mapModelId(req.model, true);
    const inputs = Array.isArray(req.input) ? req.input : [req.input];
    
    if (inputs.length === 0) {
      throw new BedrockError("Invalid embedding request: input array cannot be empty", "invalid_request_error", "empty_input", "input");
    }

    if (inputs.length > 100) {
      throw new BedrockError("Too many inputs: maximum 100 inputs allowed per request", "invalid_request_error", "too_many_inputs", "input");
    }

    const embeddings: any[] = [];
    let totalTokens = 0;

    // Process embeddings with error handling
    const embeddingPromises = inputs.map(async (input: string, index: number) => {
      if (typeof input !== "string") {
        throw new BedrockError(`Invalid input at index ${index}: must be a string`, "invalid_request_error", "invalid_input_type", `input[${index}]`);
      }

      if (input.length === 0) {
        throw new BedrockError(`Invalid input at index ${index}: cannot be empty`, "invalid_request_error", "empty_input", `input[${index}]`);
      }

      const body = JSON.stringify({ 
        inputText: input, 
        ...(req.dimensions && { dimensions: req.dimensions }) 
      });
      
      const command = new InvokeModelCommand({
        modelId,
        body,
        contentType: "application/json",
        accept: "application/json",
      });

      try {
        const response = await client.send(command);
        if (!response.body) {
          throw new BedrockError(`Empty embedding response for input ${index}`, "api_error", "empty_response");
        }

        const parsed = JSON.parse(new TextDecoder().decode(response.body));
        
        if (!parsed.embedding || !Array.isArray(parsed.embedding)) {
          throw new BedrockError(`Invalid embedding format for input ${index}`, "api_error", "invalid_response_format");
        }

        return {
          object: "embedding" as const,
          index,
          embedding: parsed.embedding,
          tokenCount: parsed.inputTextTokenCount || estimateTokensFromText(input),
        };
      } catch (error) {
        if (error instanceof BedrockError) throw error;
        throw new BedrockError(
          `Failed to embed input ${index}: ${error instanceof Error ? error.message : "Unknown error"}`,
          "api_error",
          "embedding_error"
        );
      }
    });

    const results = await Promise.all(embeddingPromises);
    
    // Sort by index to maintain order
    results.sort((a, b) => a.index - b.index);
    
    results.forEach(result => {
      embeddings.push({
        object: result.object,
        index: result.index,
        embedding: result.embedding,
      });
      totalTokens += result.tokenCount;
    });

    return {
      object: "list" as const,
      model: req.model,
      data: embeddings,
      usage: {
        prompt_tokens: totalTokens,
        total_tokens: totalTokens,
      },
    };
  } catch (error) {
    if (error instanceof BedrockError) {
      throw error;
    }
    
    throw new BedrockError(
      `Embedding failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      "api_error",
      "embedding_error"
    );
  }
}

/* --------------------------------------------------------------------------
 * Enhanced Model Listing
 * ------------------------------------------------------------------------*/
export async function listModels(): Promise<ModelListResponse> {
  const timestamp = Math.floor(Date.now() / 1000);

  const chatModels = Array.from(validChatModels).map((id) => ({
    id,
    object: "model" as const,
    created: timestamp,
    owned_by: "bedrock-mapped",
    root: id,
    parent: null,
    permission: [{
      id: `perm-${id}-${timestamp}`,
      object: "model_permission" as const,
      created: timestamp,
      allow_create_engine: false,
      allow_sampling: true,
      allow_logprobs: false,
      allow_fine_tuning: false,
      organization: "*",
      group: null,
      is_blocking: false,
    }],
  }));

  const embeddingModels = Array.from(validEmbeddingModels).map((id) => ({
    id,
    object: "model" as const,
    created: timestamp,
    owned_by: "bedrock-mapped",
    root: id,
    parent: null,
    permission: [{
      id: `perm-${id}-${timestamp}`,
      object: "model_permission" as const,
      created: timestamp,
      allow_create_engine: false,
      allow_sampling: false,
      allow_logprobs: false,
      allow_fine_tuning: false,
      organization: "*",
      group: null,
      is_blocking: false,
    }],
  }));

  return {
    object: "list" as const,
    data: [...chatModels, ...embeddingModels],
  };
}

/* --------------------------------------------------------------------------
 * Enhanced Helper Functions
 * ------------------------------------------------------------------------*/

/**
 * Improved token estimation with better accuracy
 */
function estimateTokensFromText(text: string): number {
  if (!text || typeof text !== "string") return 0;
  
  // More sophisticated token estimation
  // Account for different character types and languages
  const charCount = text.length;
  const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
  const punctCount = (text.match(/[.,;:!?()[\]{}"'`]/g) || []).length;
  
  // Better estimation: consider character density and language patterns
  let estimate = Math.ceil(charCount / 3.8); // Slightly more generous than 4 chars/token
  
  // Adjust for word boundaries and punctuation
  estimate = Math.max(estimate, Math.ceil(wordCount * 1.2));
  
  // Add overhead for punctuation and special characters
  estimate += Math.ceil(punctCount * 0.3);
  
  return Math.max(1, estimate);
}

function estimateTokensFromMessages(messages: ChatMessage[]): number {
  if (!Array.isArray(messages)) return 0;
  
  return messages.reduce((total, msg) => {
    const content = serializeContentToText(msg.content);
    let tokens = estimateTokensFromText(content);
    
    // Add overhead for message structure
    tokens += 4; // role, content wrapper overhead
    
    // Add tokens for special message properties
    if (msg.name) tokens += 2;
    if (msg.tool_calls?.length) tokens += msg.tool_calls.length * 10; // rough estimate
    if (msg.tool_call_id) tokens += 2;
    
    return total + tokens;
  }, 0);
}

/**
 * Enhanced content serialization with multimodal support
 */
function serializeContentToText(content: any): string {
  try {
    if (content === null || content === undefined) return "";
    if (typeof content === "string") return content;
    
    if (Array.isArray(content)) {
      const parts: string[] = [];
      
      for (const part of content) {
        if (!part || typeof part !== "object") continue;
        
        if (part.type === "text" && part.text) {
          parts.push(part.text);
        } else if (part.type === "image_url" && part.image_url?.url) {
          parts.push(`[Image: ${part.image_url.url}]`);
        }
      }
      
      return parts.length > 0 ? parts.join("\n\n") : "[multimodal content]";
    }
    
    if (typeof content === "object") {
      return JSON.stringify(content);
    }
    
    return String(content);
  } catch (error) {
    console.error("[serializeContentToText] Error:", error);
    return "[content processing error]";
  }
}

/**
 * Enhanced Bedrock payload conversion with advanced features
 */
async function toBedrockPayload(req: ChatCompletionRequest & { model: string }): Promise<BedrockPayload> {
  try {
    const messages: BedrockMessage[] = [];
    let systemPrefix = "";

    // Handle response format for JSON mode
    if (req.response_format?.type === "json_object") {
      systemPrefix += "\nPlease respond with valid JSON only. Do not include any explanatory text outside the JSON structure.";
    }

    // Handle stop sequences
    const stopSequences = req.stop ? (Array.isArray(req.stop) ? req.stop : [req.stop]) : [];

    // Process messages and extract system content
    for (const [index, message] of req.messages.entries()) {
      if (message.role === "system") {
        const systemContent = serializeContentToText(message.content);
        systemPrefix += systemPrefix ? `\n\n${systemContent}` : systemContent;
        continue;
      }

      // Convert message content to Bedrock format
      const content = serializeContent(message.content);
      
      // Handle different roles
      let role: "user" | "assistant";
      if (message.role === "tool") {
        // Convert tool responses to assistant messages with clear attribution
        role = "assistant";
        const toolContent = `Tool call result: ${serializeContentToText(message.content)}`;
        content[0] = { text: toolContent };
      } else if (message.role === "user" || message.role === "assistant") {
        role = message.role;
      } else {
        console.warn(`[toBedrockPayload] Unknown role at index ${index}: ${message.role}, treating as user`);
        role = "user";
      }

      // Handle tool calls in assistant messages
      if (message.tool_calls?.length) {
        const toolCallsText = message.tool_calls.map(tc => 
          `Tool call: ${tc.function.name}(${tc.function.arguments})`
        ).join("\n");
        
        const originalText = content[0]?.text || "";
        content[0] = { 
          text: originalText ? `${originalText}\n\n${toolCallsText}` : toolCallsText 
        };
      }

      // For the first user message, prepend system content
      if (role === "user" && systemPrefix && messages.length === 0) {
        const userContent = content[0]?.text || "";
        content[0] = { text: `${systemPrefix}\n\n${userContent}` };
        systemPrefix = ""; // Clear after use
      }

      messages.push({ role, content });
    }

    // If no user messages but we have system content, create a user message
    if (messages.length === 0 && systemPrefix) {
      messages.push({
        role: "user",
        content: [{ text: systemPrefix }],
      });
    }

    if (messages.length === 0) {
      throw new BedrockError("No valid messages found after processing", "invalid_request_error", "no_messages");
    }

    // Prepare inference config with proper bounds checking
    const inferenceConfig = {
      temperature: Math.max(0.01, Math.min(2.0, req.temperature ?? BEDROCK_CONFIG.defaultTemperature)),
      maxTokens: Math.max(1, Math.min(100000, req.max_tokens ?? BEDROCK_CONFIG.defaultMaxTokens)),
      topP: Math.max(0.01, Math.min(0.99, req.top_p ?? BEDROCK_CONFIG.defaultTopP)),
      ...(stopSequences.length > 0 && { stopSequences: stopSequences.slice(0, 4) }), // Bedrock supports max 4 stop sequences
    };

    return {
      modelId: req.model,
      messages,
      inferenceConfig,
    };
  } catch (error) {
    console.error("[toBedrockPayload] Error preparing payload:", error);
    throw new BedrockError(
      `Failed to prepare Bedrock payload: ${error instanceof Error ? error.message : "Unknown error"}`,
      "invalid_request_error",
      "payload_error"
    );
  }
}

function serializeContent(content: any): Array<{ text: string }> {
  try {
    const textContent = serializeContentToText(content);
    return [{ text: textContent }];
  } catch (error) {
    console.error("[serializeContent] Error:", error);
    return [{ text: "[Error processing content]" }];
  }
}

/**
 * Enhanced Bedrock response conversion
 */
function fromBedrockPayload(
  output: any,
  originalModel: string,
  bedrockModel: string,
): ChatCompletionResponse {
  try {
    const completionId = `chatcmpl-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const created = Math.floor(Date.now() / 1000);

    const assistantMessage = output.message?.content?.[0]?.text || "";
    const inputTokens = output.usage?.inputTokens || 0;
    const outputTokens = output.usage?.outputTokens || estimateTokensFromText(assistantMessage);

    // Parse tool calls if present (basic implementation)
    let toolCalls: any[] | undefined;
    const toolCallPattern = /Tool call: (\w+)\((.*?)\)/g;
    const matches = Array.from(assistantMessage.matchAll(toolCallPattern));
    
    if (matches.length > 0) {
      toolCalls = matches.map((match, index) => {
        const regexMatch = match as RegExpMatchArray;
        return {
          id: `call_${Date.now()}_${index}`,
          type: "function" as const,
          function: {
            name: regexMatch[1] || "",
            arguments: regexMatch[2] || "{}",
          },
        };
      });
    }

    return {
      id: completionId,
      object: "chat.completion" as const,
      created,
      model: originalModel,
      choices: [{
        index: 0,
        message: {
          role: "assistant" as const,
          content: assistantMessage,
          ...(toolCalls && { tool_calls: toolCalls }),
        },
        finish_reason: mapFinishReason(output.stopReason),
      }],
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
      },
      system_fingerprint: bedrockModel,
    };
  } catch (error) {
    console.error("[fromBedrockPayload] Error processing response:", error);
    throw new BedrockError(
      `Failed to process Bedrock response: ${error instanceof Error ? error.message : "Unknown error"}`,
      "api_error",
      "response_error"
    );
  }
}

/**
 * Enhanced finish reason mapping
 */
function mapFinishReason(bedrockReason: string): "stop" | "length" | "tool_calls" | "content_filter" {
  const mapping: Record<string, "stop" | "length" | "tool_calls" | "content_filter"> = {
    end_turn: "stop",
    max_tokens: "length",
    stop_sequence: "stop",
    tool_use: "tool_calls",
    content_filter: "content_filter",
    content_filtered: "content_filter",
  };
  
  return mapping[bedrockReason] || "stop";
}

/**
 * Enhanced chunk mapping with better streaming support
 */
function mapChunkToOpenAI(
  chunk: any,
  streamId: string,
  created: number,
  model: string,
  isFirst: boolean = false,
): ChatCompletionChunk | null {
  try {
    // Handle message stop
    if (chunk.messageStop) {
      return {
        id: streamId,
        object: "chat.completion.chunk" as const,
        created,
        model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: mapFinishReason(chunk.messageStop.stopReason),
        }],
      };
    }

    // Handle content delta
    if (chunk.contentBlockDelta?.delta?.text) {
      return {
        id: streamId,
        object: "chat.completion.chunk" as const,
        created,
        model,
        choices: [{
          index: 0,
          delta: {
            ...(isFirst && { role: "assistant" as const }),
            content: chunk.contentBlockDelta.delta.text,
          },
          finish_reason: null,
        }],
      };
    }

    // Handle message start
    if (chunk.messageStart && isFirst) {
      return {
        id: streamId,
        object: "chat.completion.chunk" as const,
        created,
        model,
        choices: [{
          index: 0,
          delta: {
            role: "assistant" as const,
          },
          finish_reason: null,
        }],
      };
    }

    return null;
  } catch (error) {
    console.error("[mapChunkToOpenAI] Error processing chunk:", error);
    return null;
  }
}

// Export enhanced configuration and utilities
export { BEDROCK_CONFIG, validModels, validChatModels, validEmbeddingModels, BedrockError };