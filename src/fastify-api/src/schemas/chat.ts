import { Type } from '@sinclair/typebox';
export const Message = Type.Object({
  role: Type.Union([Type.Literal('system'), Type.Literal('user'),
                    Type.Literal('assistant'), Type.Literal('tool')]),
  content: Type.Any(),           // keep identical to Pydantic model
});
export const ChatRequest = Type.Object({
  model:  Type.String(),
  messages: Type.Array(Message),
  stream: Type.Optional(Type.Boolean()),
  temperature: Type.Optional(Type.Number({ minimum: 0, maximum: 2, default: 1 })),
  top_p: Type.Optional(Type.Number({ minimum: 0, maximum: 1, default: 1 })),
  max_tokens: Type.Optional(Type.Integer({ minimum: 1, default: 2048 })),
  // …other fields from your Pydantic ChatRequest
});
export const ChatResponse = Type.Object({
  id:      Type.String(),
  object:  Type.Literal('chat.completion'),
  model:   Type.String(),
  choices: Type.Array(Type.Any()),
  usage:   Type.Any(),
});
