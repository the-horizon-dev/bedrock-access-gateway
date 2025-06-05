import { FastifyReply, FastifyRequest } from "fastify";
import { embed } from "../services/bedrock.js";
import { EmbeddingsRequest as EmbeddingsRequestSchema } from "../schemas/embeddings.js";
import { EmbeddingRequest } from "../types/api.types.js";

export class EmbeddingsController {
  static async create(
    req: FastifyRequest<{ Body: typeof EmbeddingsRequestSchema }>,
    rep: FastifyReply,
  ) {
    try {
      const response = await embed(req.body as unknown as EmbeddingRequest);
      return rep.send(response);
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }
}
