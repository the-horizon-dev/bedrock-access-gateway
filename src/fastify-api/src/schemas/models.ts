import { Type } from "@sinclair/typebox";

/* ----- Models ----- */
export const Model = Type.Object({
  id: Type.String(),
  object: Type.Literal('model'),
  created: Type.Integer(),
  owned_by: Type.String(),
});
export const Models = Type.Object({
  object: Type.Literal('list'),
  data: Type.Array(Model),
});