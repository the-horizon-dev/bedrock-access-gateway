import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION! });
const bedrockClient = new BedrockClient({ region: process.env.AWS_REGION! });

// Model mapping from OpenAI to Bedrock Anthropic models
const MODEL_MAPPING: Record<string, string> = {
  'gpt-4o': 'anthropic.claude-3-7-sonnet-20250219-v1:0',
  'gpt-4': 'anthropic.claude-3-7-sonnet-20250219-v1:0',
  'gpt-4-32k': 'anthropic.claude-3-7-sonnet-20250219-v1:0',
  'gpt-4-turbo': 'anthropic.claude-3-7-sonnet-20250219-v1:0',
  'gpt-4-turbo-preview': 'anthropic.claude-3-7-sonnet-20250219-v1:0',
  'claude-3-5-sonnet-v2': 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  'claude-3-5-haiku': 'anthropic.claude-3-5-haiku-20241022-v1:0',
  'claude-3-7-sonnet': 'anthropic.claude-3-7-sonnet-20250219-v1:0',
  'claude-4-sonnet': 'anthropic.claude-sonnet-4-20250514-v1:0',
  'claude-4-opus': 'anthropic.claude-opus-4-20250514-v1:0',
};

function mapModelId(openAIModel: string): string {
  return MODEL_MAPPING[openAIModel] || openAIModel;
}

export async function bedrockChat(req: any) {
  const bedrockModel = mapModelId(req.model);
  const command = new ConverseCommand(toBedrockPayload({ ...req, model: bedrockModel }));
  const { output } = await client.send(command);
  return fromBedrockPayload(output, req.model, bedrockModel);
}

export async function* bedrockChatStream(req: any) {
  const bedrockModel = mapModelId(req.model);
  const command = new ConverseStreamCommand(toBedrockPayload({ ...req, model: bedrockModel }));
  const { stream } = await client.send(command);
  if (!stream) return;
  
  const streamId = `chatcmpl-\${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  
  for await (const chunk of stream) {
    const openAIChunk = mapChunkToOpenAI(chunk, streamId, created, req.model);
    if (openAIChunk) yield openAIChunk;
  }
}

export async function embed(req: any) {
  // Map embedding model if needed
  const modelId = req.model === 'text-embedding-ada-002' 
    ? 'amazon.titan-embed-text-v1' 
    : req.model === 'text-embedding-3-small'
    ? 'amazon.titan-embed-text-v1'
    : req.model === 'text-embedding-3-large'
    ? 'amazon.titan-embed-text-v2:0'
    : req.model;

  const inputs = Array.isArray(req.input) ? req.input : [req.input];
  const embeddings = [];
  let totalTokens = 0;

  for (let i = 0; i < inputs.length; i++) {
    const body = JSON.stringify({ inputText: inputs[i] });
    const command = new InvokeModelCommand({
      modelId,
      body,
      contentType: 'application/json',
      accept: 'application/json',
    });
    
    const out = await client.send(command);
    const parsed = JSON.parse(new TextDecoder().decode(out.body));
    
    embeddings.push({
      object: 'embedding',
      index: i,
      embedding: parsed.embedding
    });
    
    totalTokens += parsed.inputTextTokenCount || 0;
  }

  return {
    object: 'list',
    model: req.model,
    data: embeddings,
    usage: {
      prompt_tokens: totalTokens,
      total_tokens: totalTokens
    },
  };
}

export async function listModels(): Promise<any> {
  const cmd = new ListFoundationModelsCommand({ byProvider: 'Anthropic' });
  const resp = await bedrockClient.send(cmd);
  
  // Add OpenAI model mappings
  const openAIModels = Object.keys(MODEL_MAPPING).map(id => ({
    id,
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'openai-mapped',
  }));
  
  const anthropicModels = (resp.modelSummaries ?? [])
    .filter((m: any) =>
      (m.responseStreamingSupported ?? true) &&
      ['ACTIVE', 'LEGACY'].includes(m.modelLifecycle?.status ?? 'ACTIVE'),
    )
    .map((m: any) => ({
      id: m.modelId ?? 'unknown',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'anthropic',
    }));
  
  return { 
    object: 'list', 
    data: [...openAIModels, ...anthropicModels] 
  };
}

/* ---------------- helpers ---------------- */

function toBedrockPayload(req: any) {
  const messages = req.messages.map((m: any) => {
    if (m.role === 'system') {
      // Anthropic models handle system messages differently
      return {
        role: 'user',
        content: [{ text: `System: \${m.content}` }]
      };
    }
    return {
      role: m.role,
      content: typeof m.content === 'string' 
        ? [{ text: m.content }]
        : m.content
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

function fromBedrockPayload(output: any, originalModel: string, bedrockModel: string) {
  const completionId = `chatcmpl-\${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  
  return {
    id: completionId,
    object: 'chat.completion',
    created,
    model: originalModel,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: output.message?.content?.[0]?.text || ''
        },
        finish_reason: mapFinishReason(output.stopReason),
      },
    ],
    usage: {
      prompt_tokens: output.usage?.inputTokens || 0,
      completion_tokens: output.usage?.outputTokens || 0,
      total_tokens: output.usage?.totalTokens || 0,
    },
    system_fingerprint: bedrockModel,
  };
}

function mapFinishReason(bedrockReason: string): string {
  const mapping: Record<string, string> = {
    'end_turn': 'stop',
    'max_tokens': 'length',
    'stop_sequence': 'stop',
    'tool_use': 'tool_calls',
  };
  return mapping[bedrockReason] || 'stop';
}

function mapChunkToOpenAI(chunk: any, streamId: string, created: number, model: string) {
  if (chunk.messageStop) {
    return {
      id: streamId,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: mapFinishReason(chunk.messageStop.stopReason)
      }]
    };
  }
  
  if (chunk.contentBlockDelta) {
    return {
      id: streamId,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{
        index: 0,
        delta: {
          content: chunk.contentBlockDelta.delta?.text || ''
        },
        finish_reason: null
      }]
    };
  }
  
  return null;
}