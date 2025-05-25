import 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    /**  Keys mirror the JSON-schema you passed to @fastify/env  */
    config: {
      API_KEY: string;
      AWS_REGION: string;
    };
  }
}