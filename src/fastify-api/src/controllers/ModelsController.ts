import { FastifyReply, FastifyRequest } from "fastify";
import { listModels } from "../services/bedrock.js";

export class ModelsController {
  static async list(req: FastifyRequest, rep: FastifyReply) {
    try {
      const response = await listModels();
      return rep.send(response);
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  static async getById(
    req: FastifyRequest<{ Params: { id: string } }>,
    rep: FastifyReply,
  ) {
    try {
      const models = await listModels();
      const model = models.data.find((m) => m.id === req.params.id);

      if (!model) {
        throw new Error("Model not found");
      }

      return rep.send(model);
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }
}
