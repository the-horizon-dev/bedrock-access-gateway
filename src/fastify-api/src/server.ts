import Fastify, { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyEnv from '@fastify/env';
import { FastifySSEPlugin } from 'fastify-sse-v2';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import fp from 'fastify-plugin';

import chatRoutes from './routes/chat.routes.js';
import embeddingsRoutes from './routes/embeddings.routes.js';
import modelsRoutes from './routes/models.routes.js';

// Define configuration type
declare module 'fastify' {
  interface FastifyInstance {
    config: {
      API_KEY: string;
      AWS_REGION: string;
      NODE_ENV: string;
      CORS_ORIGIN: string;
      RATE_LIMIT_MAX: number;
      RATE_LIMIT_TIME_WINDOW: string;
    }
  }
}

/**
 * Environment configuration schema
 */
const envSchema = {
  type: 'object',
  required: ['API_KEY', 'AWS_REGION'],
  properties: {
    API_KEY: { type: 'string' },
    AWS_REGION: { type: 'string' },
    NODE_ENV: { 
      type: 'string', 
      default: 'development',
      enum: ['development', 'production', 'test']
    },
    CORS_ORIGIN: { 
      type: 'string', 
      default: '*' 
    },
    RATE_LIMIT_MAX: { 
      type: 'number', 
      default: 100 
    },
    RATE_LIMIT_TIME_WINDOW: { 
      type: 'string', 
      default: '1 minute' 
    },
  },
} as const;

/**
 * Authentication plugin
 */
const authPlugin: FastifyPluginAsync = fp(async (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', async (request, reply) => {
    // Skip auth for health check and docs
    const skipAuthRoutes = ['/health', '/docs'];
    if (skipAuthRoutes.some(route => request.url.startsWith(route))) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ 
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header' 
      });
    }

    const token = authHeader.replace('Bearer ', '');
    if (token !== fastify.config.API_KEY) {
      return reply.code(401).send({ 
        error: 'Unauthorized',
        message: 'Invalid API key' 
      });
    }
  });
});

/**
 * Application plugin that registers all routes and middleware
 */
const app: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.log.info('Initializing Bedrock Gateway application...');

  // Register CORS
  await fastify.register(fastifyCors, {
    origin: fastify.config.CORS_ORIGIN === '*' ? true : fastify.config.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Register SSE support
  await fastify.register(FastifySSEPlugin);

  // Register authentication
  await fastify.register(authPlugin);

  // Register API routes
  await fastify.register(chatRoutes, { prefix: '/api/v1/chat' });
  await fastify.register(embeddingsRoutes, { prefix: '/api/v1/embeddings' });
  await fastify.register(modelsRoutes, { prefix: '/api/v1/models' });

  // Health check endpoint
  fastify.get('/health', {
    schema: {
      tags: ['System'],
      summary: 'Health check endpoint',
      description: 'Returns the health status of the service',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            version: { type: 'string' },
            environment: { type: 'string' },
          },
        },
      },
    },
  }, async () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: fastify.config.NODE_ENV,
  }));

  fastify.log.info('Bedrock Gateway application initialized successfully');
};

/**
 * Factory function that builds and configures the Fastify instance.
 * Used by both local development server and Lambda adapter.
 */
export default async function buildServer(): Promise<FastifyInstance> {
  // Create Fastify instance with TypeBox support
  const server = Fastify({
    logger: true,
    disableRequestLogging: process.env.NODE_ENV === 'production',
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
  }).withTypeProvider<TypeBoxTypeProvider>();

  try {
    // Register environment configuration with validation
    await server.register(fastifyEnv, {
      confKey: 'config',
      schema: envSchema,
      dotenv: true, // Load from .env file if available
    });

    // Register main application
    await server.register(app);

    // Global error handler
    server.setErrorHandler((error, request, reply) => {
      request.log.error({
        error: error.message,
        stack: error.stack,
        url: request.url,
        method: request.method,
      }, 'Unhandled error');

      const statusCode = error.statusCode || 500;
      const isDevelopment = server.config.NODE_ENV === 'development';

      reply.code(statusCode).send({
        error: error.name || 'Internal Server Error',
        message: error.message,
        statusCode,
        ...(isDevelopment && { stack: error.stack }),
      });
    });

    // Not found handler
    server.setNotFoundHandler((request, reply) => {
      reply.code(404).send({
        error: 'Not Found',
        message: `Route ${request.method} ${request.url} not found`,
        statusCode: 404,
      });
    });

    server.log.info('Server configuration completed');
    return server;
  } catch (error) {
    server.log.error(error, 'Failed to build server');
    throw error;
  }
}