import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import fp from "fastify-plugin";

/**
 * Enhanced logging plugin for request/response tracking
 */
const requestLoggingPlugin: FastifyPluginAsync = fp(
  async (fastify: FastifyInstance) => {
    // Log incoming requests
    fastify.addHook("onRequest", async (request: FastifyRequest) => {
      request.log.info(
        {
          url: request.url,
          method: request.method,
          headers: {
            "content-type": request.headers["content-type"],
            "user-agent": request.headers["user-agent"],
          },
        },
        "Request received",
      );
    });

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

    // Log errors
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
