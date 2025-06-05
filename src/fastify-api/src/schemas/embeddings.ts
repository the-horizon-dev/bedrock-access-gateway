import { Type } from "@sinclair/typebox";

export const EmbeddingsRequest = Type.Object({
  model: Type.String(),

  input: Type.Union([
    Type.String(),
    Type.Array(Type.Any()), 
  ]),

  encoding_format: Type.Optional(
    Type.Union([Type.Literal("float"), Type.Literal("base64")]),
  ),

  dimensions: Type.Optional(Type.Integer({ minimum: 1 })),

  user: Type.Optional(Type.String()),
});

export const Embedding = Type.Object({
  object: Type.Literal("embedding"),
  index: Type.Integer(),
  embedding: Type.Any(), 
});

export const EmbeddingsResponse = Type.Object({
  object: Type.Literal("list"),
  data: Type.Array(Embedding),
  model: Type.String(),
  usage: Type.Object({
    prompt_tokens: Type.Integer(),
    total_tokens: Type.Integer(),
  }),
});
