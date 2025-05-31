import 'fastify';

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