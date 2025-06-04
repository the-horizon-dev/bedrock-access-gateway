import awsLambdaFastify from "@fastify/aws-lambda";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import buildServer from "./server.js";

/**
 * Lambda handler with proper TypeScript types.
 * Builds the Fastify app once, then reuses it across cold-start
 * invocations for better performance.
 */
let proxy: ReturnType<typeof awsLambdaFastify> | null = null;

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  try {
    // Log request details with truncated body
    console.log("Lambda Request:", {
      requestId: context.awsRequestId,
      httpMethod: event.httpMethod,
      path: event.path,
      queryStringParameters: event.queryStringParameters,
      headers: event.headers,
      body: event.body
        ? (() => {
            try {
              const parsedBody = JSON.parse(event.body);
              // Check if this is a chat completion request
              if (parsedBody.messages && Array.isArray(parsedBody.messages)) {
                // Truncate each message's content while preserving structure
                const truncatedMessages = parsedBody.messages.map(
                  (msg: any) => ({
                    ...msg,
                    content: msg.content
                      ? typeof msg.content === "string"
                        ? msg.content.substring(0, 100) +
                          (msg.content.length > 100 ? "..." : "")
                        : msg.content
                      : undefined,
                  }),
                );
                return JSON.stringify({
                  ...parsedBody,
                  messages: truncatedMessages,
                });
              }
              // For non-chat requests, truncate the whole body
              return (
                event.body.substring(0, 100) +
                (event.body.length > 100 ? "..." : "")
              );
            } catch {
              // If JSON parsing fails, truncate the raw body
              return (
                event.body.substring(0, 100) +
                (event.body.length > 100 ? "..." : "")
              );
            }
          })()
        : undefined,
      timestamp: new Date().toISOString(),
    });

    // Initialize proxy only once (cold start optimization)
    if (!proxy) {
      const app = await buildServer();
      proxy = awsLambdaFastify(app, {
        binaryMimeTypes: ["application/octet-stream"],
      });
      await app.ready(); // Ensure all plugins are loaded
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
    console.error("Lambda handler error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
