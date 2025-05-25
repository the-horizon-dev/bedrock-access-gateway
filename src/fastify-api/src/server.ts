import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { FastifySSEPlugin } from 'fastify-sse-v2';
import env from '@fastify/env';
import fp from 'fastify-plugin';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import chatRoutes       from './routes/chat.routes.js';
import embeddingsRoutes from './routes/embeddings.routes.js';
import modelsRoutes     from './routes/models.routes.js';

/**
 * Factory that builds and configures the Fastify instance.
 * Used by both local dev (`pnpm dev`) and the Lambda adapter.
 */
export default async function buildServer() {
  const server = Fastify({ logger: true })
    .withTypeProvider<TypeBoxTypeProvider>();

  /* 1. Environment validation ----------------------------------- */
  await server.register(env, {
    confKey: 'config',                         // decorated as server.config
    schema: {
      type: 'object',
      required: ['API_KEY', 'AWS_REGION'],
      properties: {
        API_KEY:   { type: 'string' },
        AWS_REGION:{ type: 'string' },
      },
    },
  });

  /* 2. Core plugins --------------------------------------------- */
  await server.register(cors, { origin: true });
  await server.register(swagger, {
    mode: 'dynamic',
    openapi: { info: { title: 'Bedrock Gateway', version: '0.1.0' } },
  });
  await server.register(swaggerUI, { routePrefix: '/docs' });
  await server.register(FastifySSEPlugin);

  /* 3. API-key auth --------------------------------------------- */
  server.register(fp(async (instance) => {
    instance.addHook('onRequest', async (req, rep) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token !== req.server.config.API_KEY) {
        return rep.code(401).send({ error: 'Invalid API Key' });
      }
    });
  }));

  /* 4. Routes ---------------------------------------------------- */
  await server.register(chatRoutes,       { prefix: '/api/v1/chat' });
  await server.register(embeddingsRoutes, { prefix: '/api/v1/embeddings' });
  await server.register(modelsRoutes,     { prefix: '/api/v1/models' });

  server.get('/health', async () => ({ status: 'OK' }));

  /* 5. Global error handler ------------------------------------- */
  server.setErrorHandler((err, req, rep) => {
    req.log.error(err);
    rep.code(err.statusCode ?? 500).send({ error: err.message });
  });

  return server;
}