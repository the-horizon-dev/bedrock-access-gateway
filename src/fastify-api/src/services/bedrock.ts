import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';


import { randomUUID } from 'node:crypto';

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION! });
const bedrockClient = new BedrockClient({ region: process.env.AWS_REGION! });

export async function bedrockChat(req: any) {
  const command = new ConverseCommand(toBedrockPayload(req));
  const { output } = await client.send(command);
  return fromBedrockPayload(output);
}

export async function* bedrockChatStream(req: any) {
  const command = new ConverseStreamCommand(toBedrockPayload(req));
  const { stream } = await client.send(command);               // AWS doc sample :contentReference[oaicite:5]{index=5}
  if (!stream) return;
  for await (const chunk of stream) {
    yield mapChunkToOpenAI(chunk);                              // see below
  }
}

export async function embed(req: any) {
  const body = JSON.stringify({ inputText: req.input });
  const command = new InvokeModelCommand({
    modelId: req.model,
    body,
    contentType: 'application/json',
    accept: 'application/json',
  });
  const out = await client.send(command);
  const parsed = JSON.parse(new TextDecoder().decode(out.body));
  return {
    object: 'list',
    model: req.model,
    data: [{ object: 'embedding', index: 0, embedding: parsed.embedding }],
    usage: { prompt_tokens: parsed.inputTextTokenCount, total_tokens: parsed.inputTextTokenCount },
  };
}

export async function listModels(): Promise<any> {
  const cmd = new ListFoundationModelsCommand({ byOutputModality: 'TEXT' });
  const resp = await bedrockClient.send(cmd);
  const data = (resp.modelSummaries ?? [])
    .filter((m: any) =>
      (m.responseStreamingSupported ?? true) &&
      ['ACTIVE', 'LEGACY'].includes(m.modelLifecycle?.status ?? 'ACTIVE'),
    )
    .map((m: any) => ({
      id: m.modelId ?? 'unknown',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'bedrock',
    }));
  return { object: 'list', data };
}

/* ---------------- helpers ---------------- */

function toBedrockPayload(req: any) {
  // minimal example; replicate Python _parse_request for full parity
  return {
    modelId: req.model,
    messages: req.messages.map((m: any) => ({ role: m.role, content: [{ text: m.content }] })),
    inferenceConfig: {
      temperature: req.temperature,
      maxTokens: req.max_tokens,
      topP: req.top_p,
    },
  };
}

function fromBedrockPayload(out: any) {
  return {
    id: randomUUID(),
    object: 'chat.completion',
    model: out.modelId,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: out.output.message.content?.[0]?.text ?? '' },
        finish_reason: out.output.stopReason,
      },
    ],
    usage: {
      prompt_tokens: out.usage.inputTokens,
      completion_tokens: out.usage.outputTokens,
      total_tokens: out.usage.totalTokens,
    },
  };
}

function mapChunkToOpenAI(chunk: any) {
  // Translate ConverseStream chunk to OpenAI delta – see AWS doc example :contentReference[oaicite:6]{index=6}
  if (chunk.messageStop) return { choices: [{ delta: {}, finish_reason: 'stop', index: 0 }] };
  if (chunk.contentBlockDelta) {
    return {
      choices: [
        {
          delta: { role: 'assistant', content: chunk.contentBlockDelta.delta.text ?? '' },
          index: 0,
        },
      ],
    };
  }
  return null;
}