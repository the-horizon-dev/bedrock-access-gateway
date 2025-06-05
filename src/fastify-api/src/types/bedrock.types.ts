export interface BedrockMessage {
  role: "user" | "assistant";
  content: Array<{ text: string }>;
}

export interface BedrockPayload {
  modelId: string;
  messages: BedrockMessage[];
  inferenceConfig: {
    temperature: number;
    maxTokens: number;
    topP: number;
  };
}

export interface BedrockStreamChunk {
  messageStart?: {
    role: string;
  };
  contentBlockStart?: {
    contentBlockIndex: number;
  };
  contentBlockDelta?: {
    delta?: {
      text?: string;
    };
    contentBlockIndex?: number;
  };
  contentBlockStop?: {
    contentBlockIndex: number;
  };
  messageStop?: {
    stopReason?: string;
  };
  metadata?: {
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    metrics?: {
      latencyMs: number;
    };
  };
}

export interface BedrockOutput {
  message?: {
    role: string;
    content: Array<{
      text?: string;
    }>;
  };
  stopReason?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  metrics?: {
    latencyMs: number;
  };
} 