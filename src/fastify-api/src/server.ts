import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import { FastifySSEPlugin } from 'fastify-sse-v2';
import fp from 'fastify-plugin';
import env from '@fastify/env';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import swaggerUI from '@fastify/swagger-ui';

const server = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>();

// 1. Environment validation ---------------------------------
server.register(env, {
  schema: {
    type: 'object',
    required: ['API_KEY', 'AWS_REGION'],
    properties: {
      API_KEY: { type: 'string' },
      AWS_REGION: { type: 'string' },
    },
  },
});

// 2. Core plugins -------------------------------------------
await server.register(cors, { origin: true });           // CORS 
await server.register(swagger, { openapi: { info: { title: 'Bedrock Gateway', version: '0.1.0' } } });
await server.register(swaggerUI, { routePrefix: '/docs' });                  // Swagger UI 
await server.register(FastifySSEPlugin);                 // SSE streaming 

// 3. Auth (API-Key) ----------------------------------------
server.register(fp(async (instance) => {
  instance.addHook('onRequest', async (req, rep) => {
    const auth = req.headers.authorization?.replace('Bearer ', '');
    if (auth !== (req.server as any).env.API_KEY) {
      rep.code(401).send({ error: 'Invalid API Key' });
    }
  });
}));

// 4. Routes -------------------------------------------------
await server.register(import('./routes/chat.routes.js'),        { prefix: '/api/v1/chat' });
await server.register(import('./routes/embeddings.routes.js'),  { prefix: '/api/v1/embeddings' });
await server.register(import('./routes/models.routes.js'),      { prefix: '/api/v1/models' });

server.get('/health', async () => ({ status: 'OK' }));

// 5. Global error handler ----------------------------------
server.setErrorHandler((err, req, rep) => {
  req.log.error(err);
  rep.code(err.statusCode ?? 500).send({ error: err.message });
});

server.listen({ port: 8000, host: '0.0.0.0' });
