import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Model, Models } from "../schemas/models.js";
import { ModelsController } from "../controllers/ModelsController.js";

const plugin: FastifyPluginAsyncTypebox = async (f) => {
  f.get("/", { schema: { response: { 200: Models } } }, ModelsController.list);
  f.get<{ Params: { id: string } }>(
    "/:id",
    { schema: { response: { 200: Model } } },
    ModelsController.getById,
  );
};

export default plugin;
