import { Type } from "@sinclair/typebox";

/* ------------------------------------------------------------------------
 * OpenAI‑compatible Chat schema (May 2025 spec)
 * ------------------------------------------------------------------------
 *  ▸  https://platform.openai.com/docs/api-reference/chat
 *  ▸  https://github.com/openai/openai-openapi  (mirror)
 *
 *  This file is **source‑of‑truth** for request/response validation used by the
 *  Fastify Bedrock gateway.  All fields present in the public OpenAI spec up to
 *  2025‑05‑01 are represented here, including multimodal content‑parts and the
 *  latest function‑calling → tools contract.
 * --------------------------------------------------------------------- */

/* ---------- Message content parts (multimodal) ------------------------ */
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
  Type.String(), // legacy text‑only
  Type.Array(Type.Union([ContentText, ContentImageUrl])), // multimodal
]);

/* ---------- Tool / function typing ----------------------------------- */
const FunctionCall = Type.Object({
  name: Type.String(),
  arguments: Type.String(), // JSON string of arguments
});

export const ToolCall = Type.Object({
  id: Type.String(),
  type: Type.Literal("function"),
  function: FunctionCall,
});

//   ── Streaming deltas come in pieces (fields optional) ───────────────
export const ToolCallDelta = Type.Object({
  index: Type.Integer(),
  id: Type.Optional(Type.String()),
  type: Type.Optional(Type.Literal("function")),
  function: Type.Optional(Type.Partial(FunctionCall)),
});

/* ---------- Chat messages -------------------------------------------- */
export const Message = Type.Object({
  role: Type.Union([
    Type.Literal("system"),
    Type.Literal("user"),
    Type.Literal("assistant"),
    Type.Literal("function"), // ← legacy, still accepted
    Type.Literal("tool"),
  ]),
  // Content rules vary by role (spec details): we allow the superset here.
  content: Type.Optional(MessageContent),
  // Developer‑named message (e.g. when simulating multiple users)
  name: Type.Optional(Type.String()),
  // Assistant‑>function call (pre‑tools, still accepted)
  function_call: Type.Optional(FunctionCall),
  // Assistant initiating tool calls (parallel)
  tool_calls: Type.Optional(Type.Array(ToolCall)),
  // Tool response must carry the original call‑id
  tool_call_id: Type.Optional(Type.String()),
});

/* ---------- /chat/completions request -------------------------------- */
export const ChatRequest = Type.Object({
  model: Type.String({
    description:
      "ID of the model to use (OpenAI model name or mapped Bedrock).",
  }),
  messages: Type.Array(Message, {
    description: "History messages forming the conversation.",
  }),

  /* — Function‑calling / Tools — */
  tools: Type.Optional(
    Type.Array(
      Type.Object({
        type: Type.Literal("function"),
        function: Type.Object({
          name: Type.String(),
          description: Type.Optional(Type.String()),
          parameters: Type.Any(), // full JSON‑Schema
        }),
      }),
    ),
  ),
  tool_choice: Type.Optional(
    Type.Union([
      Type.Literal("none"),
      Type.Literal("auto"),
      Type.Object({
        type: Type.Literal("function"),
        function: Type.Object({ name: Type.String() }),
      }),
    ]),
  ),

  /* — Sampling & generation controls — */
  temperature: Type.Optional(Type.Number({ minimum: 0, maximum: 2 })),
  top_p: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
  n: Type.Optional(Type.Integer({ minimum: 1 })),
  max_tokens: Type.Optional(Type.Integer({ minimum: 1 })),
  presence_penalty: Type.Optional(Type.Number({ minimum: -2, maximum: 2 })),
  frequency_penalty: Type.Optional(Type.Number({ minimum: -2, maximum: 2 })),
  logit_bias: Type.Optional(Type.Record(Type.String(), Type.Number())),
  seed: Type.Optional(Type.Integer()),

  /* — Streaming — */
  stream: Type.Optional(Type.Boolean({ default: false })),
  stream_options: Type.Optional(
    Type.Object({
      include_usage: Type.Optional(Type.Boolean({ default: false })),
    }),
  ),

  /* — Stop & response format — */
  stop: Type.Optional(
    Type.Union([Type.String(), Type.Array(Type.String({}), { maxItems: 4 })]),
  ),
  response_format: Type.Optional(
    Type.Object({
      type: Type.Union([Type.Literal("text"), Type.Literal("json_object")]),
    }),
  ),

  /* — Logprobs beta — */
  logprobs: Type.Optional(
    Type.Object({
      top_logprobs: Type.Integer({ minimum: 0, maximum: 5 }),
    }),
  ),

  /* — Misc — */
  user: Type.Optional(Type.String()),
});

/* ---------- /chat/completions response -------------------------------- */
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

/* ---------- Streaming chunk ------------------------------------------ */
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
  usage: Type.Optional(Usage), // present only if include_usage=true
});
