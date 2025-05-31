import awsLambdaFastify from '@fastify/aws-lambda';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import buildServer from './server.js';

/**
 * Lambda handler with proper TypeScript types.
 * Builds the Fastify app once, then reuses it across cold-start
 * invocations for better performance.
 */
let proxy: ReturnType<typeof awsLambdaFastify> | null = null;

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Initialize proxy only once (cold start optimization)
    if (!proxy) {
      const app = await buildServer();
      await app.ready(); // Ensure all plugins are loaded
      proxy = awsLambdaFastify(app);
    }

    // Handle the request
    return new Promise((resolve, reject) => {
      proxy!(event, context, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result as APIGatewayProxyResult);
        }
      });
    });
  } catch (error) {
    console.error('Lambda handler error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};