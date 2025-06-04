import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import {
  EmbeddingsRequest,
  EmbeddingsResponse,
} from "../schemas/embeddings.js";
import { EmbeddingsController } from "../controllers/EmbeddingsController.js";

const plugin: FastifyPluginAsyncTypebox = async (f) => {
  f.post(
    "/",
    {
      schema: {
        body: EmbeddingsRequest,
        response: { 200: EmbeddingsResponse },
      },
    },
    EmbeddingsController.create,
  );
};

export default plugin;
