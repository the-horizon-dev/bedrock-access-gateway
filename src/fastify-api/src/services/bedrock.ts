import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION! });

// Model mapping from OpenAI to Bedrock Anthropic models
const MODEL_MAPPING: Record<string, string> = {
  "gpt-4o": "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
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
  return MODEL_MAPPING[openAIModel] || openAIModel;
}

export async function bedrockChat(req: any) {
  const bedrockModel = mapModelId(req.model);
  const command = new ConverseCommand(
    toBedrockPayload({ ...req, model: bedrockModel }),
  );
  const { output } = await client.send(command);
  return fromBedrockPayload(output, req.model, bedrockModel);
}

export async function* bedrockChatStream(req: any) {
  const bedrockModel = mapModelId(req.model);
  const command = new ConverseStreamCommand(
    toBedrockPayload({ ...req, model: bedrockModel }),
  );
  const { stream } = await client.send(command);
  if (!stream) return;

  const streamId = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  // Estimativas de tokens
  let outputTokenEstimate = 0;
  const promptText = req.messages
    .map((m: any) =>
      typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    )
    .join(" ");
  const promptTokens = promptText.split(/\s+/).length;

  for await (const chunk of stream) {
    const openAIChunk = mapChunkToOpenAI(chunk, streamId, created, req.model);

    // Estimar tokens a partir dos deltas
    if (chunk.contentBlockDelta?.delta?.text) {
      outputTokenEstimate +=
        chunk.contentBlockDelta.delta.text.split(/\s+/).length;
    }

    if (openAIChunk) yield openAIChunk;
  }

  // Enviar chunk final com usage simulado, se necessário
  yield {
    id: streamId,
    object: "chat.completion.chunk",
    created,
    model: req.model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: outputTokenEstimate,
      total_tokens: promptTokens + outputTokenEstimate,
    },
    system_fingerprint: bedrockModel,
  };
}

export async function embed(req: any) {
  // Map embedding model if needed
  const modelId =
    req.model === "text-embedding-ada-002"
      ? "amazon.titan-embed-text-v1"
      : req.model === "text-embedding-3-small"
        ? "amazon.titan-embed-text-v1"
        : req.model === "text-embedding-3-large"
          ? "amazon.titan-embed-text-v2:0"
          : req.model;

  const inputs = Array.isArray(req.input) ? req.input : [req.input];
  const embeddings = [];
  let totalTokens = 0;

  for (let i = 0; i < inputs.length; i++) {
    const body = JSON.stringify({ inputText: inputs[i] });
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

    totalTokens += parsed.inputTextTokenCount || 0;
  }

  return {
    object: "list",
    model: req.model,
    data: embeddings,
    usage: {
      prompt_tokens: totalTokens,
      total_tokens: totalTokens,
    },
  };
}

export async function listModels(): Promise<any> {
  // Only return the mapped models defined in MODEL_MAPPING
  const mappedModels = Object.keys(MODEL_MAPPING).map((id) => ({
    id,
    object: "model",
    created: Math.floor(Date.now() / 1000),
    owned_by: "openai-mapped",
  }));

  return {
    object: "list",
    data: mappedModels,
  };
}

/* ---------------- helpers ---------------- */

function toBedrockPayload(req: any) {
  const messages = req.messages.map((m: any) => {
    if (m.role === "system") {
      // Anthropic models handle system messages differently
      return {
        role: "user",
        content: [{ text: `System: ${m.content}` }],
      };
    }
    return {
      role: m.role,
      content:
        typeof m.content === "string" ? [{ text: m.content }] : m.content,
    };
  });

  return {
    modelId: req.model,
    messages,
    inferenceConfig: {
      temperature: req.temperature || 1.0,
      maxTokens: req.max_tokens || 2048,
      topP: req.top_p || 1.0,
    },
  };
}

function fromBedrockPayload(
  output: any,
  originalModel: string,
  bedrockModel: string,
) {
  const completionId = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  const assistantMessage = output.message?.content?.[0]?.text || "";

  const inputTokens = output.usage?.inputTokens;
  const outputTokens = output.usage?.outputTokens;
  const totalTokens = output.usage?.totalTokens;

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
      prompt_tokens: inputTokens ?? assistantMessage.split(/\s+/).length, // fallback: word count estimate
      completion_tokens: outputTokens ?? assistantMessage.split(/\s+/).length,
      total_tokens:
        totalTokens ??
        (inputTokens ?? 0) +
          (outputTokens ?? assistantMessage.split(/\s+/).length),
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
  return mapping[bedrockReason] || "stop";
}

function mapChunkToOpenAI(
  chunk: any,
  streamId: string,
  created: number,
  model: string,
) {
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
            content: chunk.contentBlockDelta.delta?.text || "",
          },
          finish_reason: null,
        },
      ],
    };
  }

  return null;
}
