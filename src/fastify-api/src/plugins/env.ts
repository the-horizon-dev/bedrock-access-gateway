import fp from 'fastify-plugin';
import env from '@fastify/env';

export default fp(async (f) => {
  f.register(env, {
    schema: {
      type: 'object',
      required: ['API_KEY', 'AWS_REGION'],
      properties: {
        API_KEY: { type: 'string' },
        AWS_REGION: { type: 'string' },
      },
    },
  });
});