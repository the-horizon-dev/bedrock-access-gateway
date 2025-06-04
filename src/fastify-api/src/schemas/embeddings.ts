import { Type } from "@sinclair/typebox";

/* ------------------------------------------------------------------------
 * OpenAI-compatible Embeddings schemas (May‑2025 spec)
 * --------------------------------------------------------------------- */

/* ================================
 *  /v1/embeddings
 * ==============================*/

export const EmbeddingsRequest = Type.Object({
  /** Identifier of the embeddings model to use. */
  model: Type.String(),

  /**
   * Input text(s) to embed. The API accepts either a single string
   * or an array of strings / tokens. (We keep the superset here.)
   */
  input: Type.Union([
    Type.String(),
    Type.Array(Type.Any()), // string | number tokens
  ]),

  /** Format of the returned embedding: 1536 floats or base64‑encoded */
  encoding_format: Type.Optional(
    Type.Union([Type.Literal("float"), Type.Literal("base64")]),
  ),

  /** Truncate / pad the resulting vector to `dimensions` length (if supported). */
  dimensions: Type.Optional(Type.Integer({ minimum: 1 })),

  /** End‑user ID for abuse monitoring & analytics (propagated verbatim). */
  user: Type.Optional(Type.String()),
});

export const Embedding = Type.Object({
  object: Type.Literal("embedding"),
  index: Type.Integer(),
  embedding: Type.Any(), // number[] | string (base64)
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
