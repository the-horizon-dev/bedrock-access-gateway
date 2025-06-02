import Fastify, { FastifyInstance, FastifyPluginAsync } from "fastify";
import fastifyCors from "@fastify/cors";
import { FastifySSEPlugin } from "fastify-sse-v2";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import fp from "fastify-plugin";

import { registerEnvConfig } from "./config/env.js";
import chatRoutes from "./routes/chat.routes.js";
import embeddingsRoutes from "./routes/embeddings.routes.js";
import modelsRoutes from "./routes/models.routes.js";

/**
 * Authentication plugin
 */
const authPlugin: FastifyPluginAsync = fp(async (fastify: FastifyInstance) => {
  fastify.addHook("onRequest", async (request, reply) => {
    // Skip auth for health check and docs
    const skipAuthRoutes = ["/health", "/docs", "/v1/models"];
    if (skipAuthRoutes.some((route) => request.url.startsWith(route))) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.code(401).send({
        error: {
          message: "Missing or invalid authorization header",
          type: "invalid_request_error",
          code: "invalid_api_key",
        },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    if (token !== fastify.config.API_KEY) {
      return reply.code(401).send({
        error: {
          message: "Invalid API key",
          type: "invalid_request_error",
          code: "invalid_api_key",
        },
      });
    }
  });
});

/**
 * Application plugin that registers all routes and middleware
 */
const app: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.log.info("Initializing OpenAI-compatible Bedrock Gateway...");

  // Register CORS
  await fastify.register(fastifyCors, {
    origin:
      fastify.config.CORS_ORIGIN === "*" ? true : fastify.config.CORS_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Register SSE support
  await fastify.register(FastifySSEPlugin);

  // Register authentication
  await fastify.register(authPlugin);

  // Register OpenAI-compatible API routes
  await fastify.register(chatRoutes, { prefix: "api/v1/chat" });
  await fastify.register(embeddingsRoutes, { prefix: "api/v1/embeddings" });
  await fastify.register(modelsRoutes, { prefix: "api/v1/models" });

  // Health check endpoint
  fastify.get(
    "/health",
    {
      schema: {
        tags: ["System"],
        summary: "Health check endpoint",
        description: "Returns the health status of the service",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              timestamp: { type: "string" },
              version: { type: "string" },
              environment: { type: "string" },
            },
          },
        },
      },
    },
    async () => ({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      environment: fastify.config.NODE_ENV,
    }),
  );

  fastify.log.info(
    "OpenAI-compatible Bedrock Gateway initialized successfully",
  );
};

/**
 * Factory function that builds and configures the Fastify instance.
 * Used by both local development server and Lambda adapter.
 */
export default async function buildServer(): Promise<FastifyInstance> {
  // Create Fastify instance with TypeBox support
  const server = Fastify({
    logger: true,
    disableRequestLogging: process.env.NODE_ENV === "production",
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "reqId",
  }).withTypeProvider<TypeBoxTypeProvider>();
  try {
    // Register environment configuration with validation
    await registerEnvConfig(server);

    // Register main application
    await server.register(app);

    // Global error handler - OpenAI compatible format
    server.setErrorHandler((error, request, reply) => {
      request.log.error(
        {
          error: error.message,
          stack: error.stack,
          url: request.url,
          method: request.method,
        },
        "Unhandled error",
      );

      const statusCode = error.statusCode || 500;
      const isDevelopment = server.config.NODE_ENV === "development";

      if (!reply.raw.writableEnded) {
        reply.code(statusCode).send({
          error: {
            message: error.message,
            type: "api_error",
            code: error.code || "internal_error",
            ...(isDevelopment && { stack: error.stack }),
          },
        });
      }
    });

    // Not found handler - OpenAI compatible format
    server.setNotFoundHandler((request, reply) => {
      reply.code(404).send({
        error: {
          message: `Route not found`,
          type: "invalid_request_error",
          code: "not_found",
        },
      });
    });

    server.log.info("Server configuration completed");
    return server;
  } catch (error) {
    server.log.error(error, "Failed to build server");
    throw error;
  }
}
