// src/plugins/logging.ts
import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import fp from "fastify-plugin";

/**
 * Enhanced logging plugin to help debug request/response issues
 */
const requestLoggingPlugin: FastifyPluginAsync = fp(
  async (fastify: FastifyInstance) => {
    // Log all incoming requests
    fastify.addHook("onRequest", async (request: FastifyRequest) => {
      request.log.info(
        {
          url: request.url,
          method: request.method,
          headers: {
            "content-type": request.headers["content-type"],
            "content-length": request.headers["content-length"],
            "user-agent": request.headers["user-agent"],
            accept: request.headers["accept"],
          },
        },
        "Request received",
      );
    });

    // Log parsed body (after parsing, before validation)
    fastify.addHook("preValidation", async (request: FastifyRequest) => {
      if (request.body) {
        const bodyType = typeof request.body;
        const bodyInfo =
          bodyType === "object"
            ? {
                type: bodyType,
                hasBody: true,
                keys: Object.keys(request.body as object),
                size: JSON.stringify(request.body).length,
              }
            : { type: bodyType, value: request.body };

        request.log.info({ body: bodyInfo }, "Request body after parsing");
      } else {
        request.log.warn("Request body is empty or undefined after parsing");
      }
    });

    // Log validation errors
    fastify.addHook(
      "preSerialization",
      async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
        if (reply.statusCode >= 400) {
          request.log.error(
            {
              statusCode: reply.statusCode,
              error: payload.error,
            },
            "Error response",
          );
        } else {
          // For successful responses, log a summarized version
          const summary =
            typeof payload === "object"
              ? {
                  object: payload.object,
                  id: payload.id,
                  model: payload.model,
                  choicesCount: payload.choices?.length,
                  hasUsage: !!payload.usage,
                }
              : { type: typeof payload };

          request.log.info(
            {
              statusCode: reply.statusCode,
              response: summary,
            },
            "Success response",
          );
        }
      },
    );

    // Log when request completes
    fastify.addHook(
      "onResponse",
      async (request: FastifyRequest, reply: FastifyReply) => {
        request.log.info(
          {
            url: request.url,
            method: request.method,
            statusCode: reply.statusCode,
            responseTime: reply.elapsedTime,
          },
          "Request completed",
        );
      },
    );

    // Log any errors
    fastify.addHook(
      "onError",
      async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
        request.log.error(
          {
            url: request.url,
            method: request.method,
            error: {
              message: error.message,
              stack: error.stack,
            },
          },
          "Request error occurred",
        );
      },
    );
  },
);

export default requestLoggingPlugin;
