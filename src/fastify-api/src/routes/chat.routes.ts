// src/routes/chat.routes.ts
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
      // Add pre-validation hook for debugging
      preValidation: (request, reply, done) => {
        // When content type is not recognized properly
        const contentType = request.headers["content-type"];
        if (!contentType || !contentType.includes("application/json")) {
          request.log.warn(
            {
              contentType,
              body: request.body,
            },
            "Request may have incorrect content-type",
          );
        }

        if (typeof request.body === "string") {
          request.log.warn(
            "Body received as string, attempting to parse as JSON",
          );
          try {
            request.body = JSON.parse(request.body);
            request.log.info("Successfully parsed string body as JSON");
          } catch (error) {
            request.log.error(
              { error },
              "Failed to parse request body as JSON",
            );
          }
        }

        request.log.debug(
          {
            hasBody: !!request.body,
            bodyType: typeof request.body,
          },
          "Request body pre-validation",
        );

        done();
      },
    },
    CompletionsController.handle,
  );
};

export default plugin;
