import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { ChatRequest, ChatResponse } from "../schemas/chat.js";
import { CompletionsController } from "../controllers/CompletionsController.js";

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    "/completions",
    {
      schema: {
        body: ChatRequest,
        response: { 200: ChatResponse },
        tags: ["Chat"],
        summary: "Create chat completion",
        description:
          "Creates a completion for the chat message (OpenAI compatible)",
      },
    },
    CompletionsController.handle,
  );
};

export default plugin;
