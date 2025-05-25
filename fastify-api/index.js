import Fastify from 'fastify';
import cors from '@fastify/cors';

const fastify = Fastify({ logger: true });
await fastify.register(cors, { origin: true });

fastify.get('/health', async (request, reply) => {
  return { status: 'OK' };
});

fastify.post('/chat/completions', async (request, reply) => {
  const body = request.body;
  // TODO: integrate with Amazon Bedrock
  return body;
});

fastify.post('/embeddings', async (request, reply) => {
  const body = request.body;
  // TODO: integrate with Amazon Bedrock
  return body;
});

fastify.get('/models', async (request, reply) => {
  // TODO: fetch model list from Bedrock
  return { object: 'list', data: [] };
});

fastify.get('/models/:model_id', async (request, reply) => {
  const { model_id } = request.params;
  return { id: model_id };
});

const PORT = process.env.PORT || 8000;

fastify.listen({ port: PORT, host: '0.0.0.0' }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
