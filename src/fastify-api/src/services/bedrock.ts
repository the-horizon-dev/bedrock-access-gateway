import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

/* --------------------------------------------------------------------------
 *  Bedrock service wrapper that presents an **OpenAI-compatible** façade.
 *  Updated June-2025 to match the latest Chat / Embeddings / Models schemas:
 *    • multimodal content parts (text + image_url)
 *    • tools / tool_choice contract (ignored by Bedrock, but accepted)
 *    • extended Model object with permission array
 * ------------------------------------------------------------------------*/

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION! });

/* --------------------------------------------------------------------------
 * 1️⃣  Model mapping – OpenAI model id → Bedrock model id
 * ------------------------------------------------------------------------*/
export const MODEL_MAPPING: Record<string, string> = {
  "gpt-4o": "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
  "gpt-4o-mini": "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
  "gpt-4": "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
  "gpt-4-32k": "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
  "gpt-4-turbo": "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
  "gpt-4-turbo-preview": "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
  "claude-3-5-sonnet-v2": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
  "claude-3-5-haiku": "us.anthropic.claude-3-5-haiku-20241022-v1:0",
  "claude-3-7-sonnet": "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
  "claude-sonnet-4-20250514": "us.anthropic.claude-sonnet-4-20250514-v1:0",
  "claude-opus-4-20250514": "us.anthropic.claude-opus-4-20250514-v1:0",
};

function mapModelId(openAIModel: string): string {
  return MODEL_MAPPING[openAIModel] ?? openAIModel;
}

/* --------------------------------------------------------------------------
 * 2️⃣  Chat – non-streaming
 * ------------------------------------------------------------------------*/
export async function bedrockChat(req: any) {
  if (!req) {
    throw new Error("Invalid request: request object is undefined");
  }

  // Log the incoming request for debugging
  console.log(`[bedrockChat] Received request for model: ${req.model}`);

  // Ignore `tools`, `tool_choice` & other OpenAI-only fields
  const { tools, tool_choice, stream, stream_options, ...chat } = req;

  if (!chat.model) {
    throw new Error("Invalid request: model is required");
  }

  if (
    !chat.messages ||
    !Array.isArray(chat.messages) ||
    chat.messages.length === 0
  ) {
    throw new Error(
      "Invalid request: messages array is required and cannot be empty",
    );
  }

  try {
    const bedrockModel = mapModelId(chat.model);
    console.log(`[bedrockChat] Mapped model ${chat.model} -> ${bedrockModel}`);

    const payload = toBedrockPayload({ ...chat, model: bedrockModel });
    console.log(
      `[bedrockChat] Prepared Bedrock payload with ${payload.messages.length} messages`,
    );

    const command = new ConverseCommand(payload);
    const { output } = await client.send(command);

    if (!output) {
      throw new Error("Bedrock API returned empty output");
    }

    return fromBedrockPayload(output, chat.model, bedrockModel);
  } catch (error) {
    console.error("[bedrockChat] Error:", error);
    throw error;
  }
}

/* --------------------------------------------------------------------------
 * 3️⃣  Chat – streaming (Server-Sent Events)
 * ------------------------------------------------------------------------*/
export async function* bedrockChatStream(req: any) {
  const { tools, tool_choice, ...chat } = req;
  const bedrockModel = mapModelId(chat.model);

  const command = new ConverseStreamCommand(
    toBedrockPayload({ ...chat, model: bedrockModel }),
  );
  const { stream } = await client.send(command);
  if (!stream) return;

  const streamId = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  /* ── crude token accounting for usage estimation ──────────────────── */
  const promptTokens = countTokensFromMessages(chat.messages);
  let completionTokens = 0;

  for await (const chunk of stream) {
    const openAIChunk = mapChunkToOpenAI(chunk, streamId, created, chat.model);

    if (chunk.contentBlockDelta?.delta?.text) {
      completionTokens +=
        chunk.contentBlockDelta.delta.text.split(/\s+/).length;
    }

    if (openAIChunk) yield openAIChunk;
  }

  /* ── final synthetic DONE message with usage block ─────────────────── */
  yield {
    id: streamId,
    object: "chat.completion.chunk",
    created,
    model: chat.model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
    system_fingerprint: bedrockModel,
  };
}

/* --------------------------------------------------------------------------
 * 4️⃣  Embeddings
 * ------------------------------------------------------------------------*/
export async function embed(req: any) {
  const { dimensions, ...emb } = req;
  const modelId =
    emb.model === "text-embedding-ada-002"
      ? "amazon.titan-embed-text-v1"
      : emb.model === "text-embedding-3-small"
        ? "amazon.titan-embed-text-v1"
        : emb.model === "text-embedding-3-large"
          ? "amazon.titan-embed-text-v2:0"
          : emb.model;

  const inputs = Array.isArray(emb.input) ? emb.input : [emb.input];
  const embeddings: any[] = [];
  let totalTokens = 0;

  for (let i = 0; i < inputs.length; i++) {
    const body = JSON.stringify({ inputText: inputs[i], dimensions });
    const command = new InvokeModelCommand({
      modelId,
      body,
      contentType: "application/json",
      accept: "application/json",
    });

    const out = await client.send(command);
    const parsed = JSON.parse(new TextDecoder().decode(out.body));

    embeddings.push({
      object: "embedding",
      index: i,
      embedding: parsed.embedding,
    });

    totalTokens += parsed.inputTextTokenCount ?? 0;
  }

  return {
    object: "list",
    model: emb.model,
    data: embeddings,
    usage: {
      prompt_tokens: totalTokens,
      total_tokens: totalTokens,
    },
  };
}

/* --------------------------------------------------------------------------
 * 5️⃣  Model listing (OpenAI shape incl. permissions)
 * ------------------------------------------------------------------------*/
export async function listModels() {
  const ts = Math.floor(Date.now() / 1000);

  const data = Object.keys(MODEL_MAPPING).map((id) => ({
    id,
    object: "model",
    created: ts,
    owned_by: "openai-mapped",
    root: id,
    parent: null,
    permission: [
      {
        id: `perm-${id}-${ts}`,
        object: "model_permission",
        created: ts,
        allow_create_engine: false,
        allow_sampling: true,
        allow_logprobs: false,
        allow_fine_tuning: false,
        organization: "*",
        group: null,
        is_blocking: false,
      },
    ],
  }));

  return {
    object: "list",
    data,
  };
}

/* --------------------------------------------------------------------------
 * 6️⃣  Helpers
 * ------------------------------------------------------------------------*/

function countTokensFromMessages(messages: any[]): number {
  const joined = messages
    .map((m) =>
      typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    )
    .join(" ");
  return joined.trim().split(/\s+/).length;
}

/**
 * Serialize OpenAI message array → Bedrock Converse payload.
 *   • System messages are prepended inside the first user message.
 *   • Multimodal parts are flattened – non-text parts are dropped (Bedrock
 *     currently ignores images).
 */
function toBedrockPayload(req: any) {
  try {
    if (!req.messages || !Array.isArray(req.messages)) {
      console.error("[toBedrockPayload] Invalid messages array:", req.messages);
      throw new Error("Invalid messages format: expected an array");
    }

    const messages = req.messages.map((m: any, index: number) => {
      if (!m || typeof m !== "object") {
        console.error(
          `[toBedrockPayload] Invalid message at index ${index}:`,
          m,
        );
        throw new Error(
          `Invalid message at position ${index}: expected an object`,
        );
      }

      // Bedrock (Anthropic) treats \"system\" as a prefix inside user content.
      if (m.role === "system") {
        return {
          role: "user",
          content: serializeContent(`System: ${m.content}`),
        };
      }

      // Collapse multimodal content to plain text (Bedrock limitation)
      const safeContent = serializeContent(m.content);

      // OpenAI role "tool" has no direct equivalent – treat as assistant.
      const role = m.role === "tool" ? "assistant" : m.role;

      return { role, content: safeContent };
    });

    return {
      modelId: req.model,
      messages,
      inferenceConfig: {
        temperature: req.temperature ?? 1.0,
        maxTokens: req.max_tokens ?? 2048,
        topP: req.top_p ?? 1.0,
      },
    };
  } catch (error) {
    console.error("[toBedrockPayload] Error preparing payload:", error);
    throw error;
  }
}

function serializeContent(content: any): { text: string }[] {
  try {
    if (content === undefined || content === null) {
      console.warn(
        "[serializeContent] Content is null or undefined, using empty text",
      );
      return [{ text: "" }];
    }

    if (typeof content === "string") {
      return [{ text: content }];
    }

    if (Array.isArray(content)) {
      // Keep only text parts; concatenate if multiple.
      const texts = content
        .filter((p) => p && p.type === "text")
        .map((p) => p.text as string);

      return texts.length > 0
        ? [{ text: texts.join("\n\n") }]
        : [{ text: "[non-text content omitted]" }];
    }

    // For objects or other types, stringify them
    console.warn("[serializeContent] Unexpected content type:", typeof content);
    return [{ text: JSON.stringify(content) }];
  } catch (error) {
    console.error("[serializeContent] Error processing content:", error);
    return [{ text: "[Error processing content]" }];
  }
}

function fromBedrockPayload(
  output: any,
  originalModel: string,
  bedrockModel: string,
) {
  const completionId = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  const assistantMessage = output.message?.content?.[0]?.text ?? "";

  return {
    id: completionId,
    object: "chat.completion",
    created,
    model: originalModel,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: assistantMessage,
        },
        finish_reason: mapFinishReason(output.stopReason),
      },
    ],
    usage: {
      prompt_tokens:
        output.usage?.inputTokens ?? assistantMessage.split(/\s+/).length,
      completion_tokens:
        output.usage?.outputTokens ?? assistantMessage.split(/\s+/).length,
      total_tokens:
        output.usage?.totalTokens ??
        (output.usage?.inputTokens ?? 0) +
          (output.usage?.outputTokens ?? assistantMessage.split(/\s+/).length),
    },
    system_fingerprint: bedrockModel,
  };
}

function mapFinishReason(bedrockReason: string): string {
  const mapping: Record<string, string> = {
    end_turn: "stop",
    max_tokens: "length",
    stop_sequence: "stop",
    tool_use: "tool_calls",
  };
  return mapping[bedrockReason] ?? "stop";
}

function mapChunkToOpenAI(
  chunk: any,
  streamId: string,
  created: number,
  model: string,
) {
  /* Bedrock stream event → OpenAI SSE chunk */
  if (chunk.messageStop) {
    return {
      id: streamId,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: mapFinishReason(chunk.messageStop.stopReason),
        },
      ],
    };
  }

  if (chunk.contentBlockDelta) {
    return {
      id: streamId,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [
        {
          index: 0,
          delta: {
            role: "assistant",
            content: chunk.contentBlockDelta.delta?.text ?? "",
          },
          finish_reason: null,
        },
      ],
    };
  }

  return null;
}
