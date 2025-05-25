import awsLambdaFastify from '@fastify/aws-lambda';
import buildServer from './server.js';

/**
 * Builds the Fastify app once, then reuses it across cold-start
 * invocations.  The returned handler is what API Gateway / Lambda
 * actually calls.
 */
let proxy: ReturnType<typeof awsLambdaFastify>;

export const handler = async (event: any, context: any) => {
  if (!proxy) {
    const app = await buildServer();
    proxy = awsLambdaFastify(app);
  }
  return proxy(event, context, (err, result) => {
    if (err) throw err;
    return result;
  });
};