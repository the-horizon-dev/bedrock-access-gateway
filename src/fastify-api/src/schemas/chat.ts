import { Type } from "@sinclair/typebox";

export const ContentText = Type.Object({
  type: Type.Literal("text"),
  text: Type.String(),
});

export const ContentImageUrl = Type.Object({
  type: Type.Literal("image_url"),
  image_url: Type.Object({
    url: Type.String(),
    detail: Type.Optional(
      Type.Union([
        Type.Literal("auto"),
        Type.Literal("low"),
        Type.Literal("high"),
      ]),
    ),
  }),
});

export const MessageContent = Type.Union([
  Type.String(),
  Type.Array(Type.Union([ContentText, ContentImageUrl])),
]);

export const FunctionSpec = Type.Object({
  name: Type.String(),
  description: Type.Optional(Type.String()),
  parameters: Type.Optional(Type.Any()), // optional for legacy payloads
});

const FunctionCall = FunctionSpec;

export const ToolCall = Type.Object({
  id: Type.String(),
  type: Type.Literal("function"),
  function: FunctionCall,
});

export const ToolCallDelta = Type.Object({
  index: Type.Integer(),
  id: Type.Optional(Type.String()),
  type: Type.Optional(Type.Literal("function")),
  function: Type.Optional(Type.Partial(FunctionCall)),
});

const ToolWrapper = Type.Object({
  type: Type.Optional(Type.Literal("function")),
  function: FunctionSpec,
});
const BareTool = FunctionSpec;
const FlatToolWithType = Type.Intersect([
  Type.Object({ type: Type.Optional(Type.Literal("function")) }),
  FunctionSpec,
]);

export const Message = Type.Object({
  role: Type.Union([
    Type.Literal("system"),
    Type.Literal("user"),
    Type.Literal("assistant"),
    Type.Literal("function"),
    Type.Literal("tool"),
  ]),
  content: Type.Optional(MessageContent),
  name: Type.Optional(Type.String()),
  function_call: Type.Optional(FunctionCall),
  tool_calls: Type.Optional(Type.Array(ToolCall)),
  tool_call_id: Type.Optional(Type.String()),
});

export const ChatRequest = Type.Object({
  model: Type.String({ description: "Model id (OpenAI or mapped)." }),
  messages: Type.Array(Message, { description: "Conversation history." }),

  tools: Type.Optional(
    Type.Array(Type.Union([ToolWrapper, FlatToolWithType, BareTool])),
  ),

  tool_choice: Type.Optional(
    Type.Union([
      Type.Literal("none"),
      Type.Literal("auto"),
      Type.Literal("required"),

      Type.Object({ type: Type.Literal("none") }),
      Type.Object({ type: Type.Literal("auto") }),
      Type.Object({ type: Type.Literal("required") }),

      Type.Intersect([
        Type.Object({ type: Type.Optional(Type.Literal("function")) }),
        Type.Object({ name: Type.String() }),
      ]),

      Type.Object({
        type: Type.Literal("function"),
        function: Type.Object({ name: Type.String() }),
      }),
    ]),
  ),

  temperature: Type.Optional(Type.Number({ minimum: 0, maximum: 2 })),
  top_p: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
  n: Type.Optional(Type.Integer({ minimum: 1 })),
  max_tokens: Type.Optional(Type.Integer({ minimum: 1 })),
  presence_penalty: Type.Optional(Type.Number({ minimum: -2, maximum: 2 })),
  frequency_penalty: Type.Optional(Type.Number({ minimum: -2, maximum: 2 })),
  logit_bias: Type.Optional(Type.Record(Type.String(), Type.Number())),
  seed: Type.Optional(Type.Integer()),

  stream: Type.Optional(Type.Boolean({ default: false })),
  stream_options: Type.Optional(
    Type.Object({
      include_usage: Type.Optional(Type.Boolean({ default: false })),
    }),
  ),

  stop: Type.Optional(
    Type.Union([Type.String(), Type.Array(Type.String(), { maxItems: 4 })]),
  ),
  response_format: Type.Optional(
    Type.Object({
      type: Type.Union([Type.Literal("text"), Type.Literal("json_object")]),
    }),
  ),

  logprobs: Type.Optional(
    Type.Object({ top_logprobs: Type.Integer({ minimum: 0, maximum: 5 }) }),
  ),

  user: Type.Optional(Type.String()),
}, { additionalProperties: true });

export const ChoiceMessage = Type.Object({
  role: Type.Literal("assistant"),
  content: Type.Union([Type.String(), Type.Null()]),
  tool_calls: Type.Optional(Type.Array(ToolCall)),
});

export const Choice = Type.Object({
  index: Type.Integer(),
  message: ChoiceMessage,
  finish_reason: Type.Union([
    Type.Literal("stop"),
    Type.Literal("length"),
    Type.Literal("tool_calls"),
    Type.Literal("content_filter"),
    Type.Null(),
  ]),
});

export const Usage = Type.Object({
  prompt_tokens: Type.Integer(),
  completion_tokens: Type.Integer(),
  total_tokens: Type.Integer(),
});

export const ChatResponse = Type.Object({
  id: Type.String(),
  object: Type.Literal("chat.completion"),
  created: Type.Integer(),
  model: Type.String(),
  choices: Type.Array(Choice),
  usage: Usage,
  system_fingerprint: Type.Optional(Type.String()),
});

export const ChoiceDelta = Type.Object({
  role: Type.Optional(Type.Literal("assistant")),
  content: Type.Optional(Type.String()),
  tool_calls: Type.Optional(Type.Array(ToolCallDelta)),
});

export const ChatChunk = Type.Object({
  id: Type.String(),
  object: Type.Literal("chat.completion.chunk"),
  created: Type.Integer(),
  model: Type.String(),
  choices: Type.Array(
    Type.Object({
      index: Type.Integer(),
      delta: ChoiceDelta,
      finish_reason: Type.Optional(
        Type.Union([
          Type.Literal("stop"),
          Type.Literal("length"),
          Type.Literal("tool_calls"),
          Type.Literal("content_filter"),
          Type.Null(),
        ]),
      ),
    }),
  ),
  usage: Type.Optional(Usage),
});