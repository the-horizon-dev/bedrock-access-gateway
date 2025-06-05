// OpenAI-compatible API types

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, any>;
  };
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stream_options?: {
    include_usage?: boolean;
  };
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  tools?: Tool[];
  tool_choice?: "none" | "auto" | "required" | { type: "function"; function: { name: string } };
  response_format?: { type: "text" | "json_object" };
  seed?: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatChoice[];
  usage: Usage;
  system_fingerprint?: string;
}

export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
  logprobs?: null;
}

export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: ChatChunkChoice[];
  usage?: Usage;
  system_fingerprint?: string;
}

export interface ChatChunkChoice {
  index: number;
  delta: Partial<ChatMessage>;
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
  logprobs?: null;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface EmbeddingRequest {
  model: string;
  input: string | string[];
  encoding_format?: "float" | "base64";
  dimensions?: number;
  user?: string;
}

export interface EmbeddingResponse {
  object: "list";
  model: string;
  data: Embedding[];
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface Embedding {
  object: "embedding";
  index: number;
  embedding: number[];
}

export interface Model {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
  root: string;
  parent: string | null;
  permission: ModelPermission[];
}

export interface ModelPermission {
  id: string;
  object: "model_permission";
  created: number;
  allow_create_engine: boolean;
  allow_sampling: boolean;
  allow_logprobs: boolean;
  allow_fine_tuning: boolean;
  organization: string;
  group: string | null;
  is_blocking: boolean;
}

export interface ModelListResponse {
  object: "list";
  data: Model[];
}

export interface ErrorResponse {
  error: {
    message: string;
    type: string;
    code: string;
    param?: string;
  };
} 