import { Type } from "@sinclair/typebox";

/* ------------------------------------------------------------------------
 * OpenAI-compatible Models schemas (May‑2025 spec)
 * --------------------------------------------------------------------- */

/* ================================
 *  /v1/models
 * ==============================*/

export const ModelPermission = Type.Object({
  id: Type.String(),
  object: Type.Literal("model_permission"),
  created: Type.Integer(),
  allow_create_engine: Type.Boolean(),
  allow_sampling: Type.Boolean(),
  allow_logprobs: Type.Boolean(),
  allow_fine_tuning: Type.Boolean(),
  organization: Type.String(),
  group: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  is_blocking: Type.Boolean(),
});

export const Model = Type.Object({
  id: Type.String(),
  object: Type.Literal("model"),
  created: Type.Integer(),
  owned_by: Type.String(),
  root: Type.Optional(Type.String()),
  parent: Type.Optional(Type.String({})),
  permission: Type.Optional(Type.Array(ModelPermission)),
});

export const Models = Type.Object({
  object: Type.Literal("list"),
  data: Type.Array(Model),
});
