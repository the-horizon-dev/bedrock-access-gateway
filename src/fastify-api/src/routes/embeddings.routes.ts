import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import {
  EmbeddingsRequest,
  EmbeddingsResponse,
} from "../schemas/embeddings.js";
import { embed } from "../services/bedrock.js";

const plugin: FastifyPluginAsyncTypebox = async (f) => {
  f.post(
    "/",
    {
      schema: {
        body: EmbeddingsRequest,
        response: { 200: EmbeddingsResponse },
      },
    },
    async (req) => embed(req.body) as any,
  );
};

export default plugin;
