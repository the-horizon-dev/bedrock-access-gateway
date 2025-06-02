import { Type } from "@sinclair/typebox";

/* ----- Embeddings ----- */
export const EmbeddingsRequest = Type.Object({
  model: Type.String(),
  input: Type.Union([Type.String(), Type.Array(Type.String())]),
  encoding_format: Type.Optional(
    Type.Union([Type.Literal("float"), Type.Literal("base64")]),
  ),
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
