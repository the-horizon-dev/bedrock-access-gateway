// =====================================================================
// Lambda entrypoint with privacy‑first logging
// =====================================================================
import awsLambdaFastify from "@fastify/aws-lambda";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import buildServer from "./server.js";

// Re‑used Fastify proxy across cold starts
let proxy: ReturnType<typeof awsLambdaFastify> | null = null;

// ---------------------------------------------------------------------
// Helper – scrub body for safe/insightful logging
// ---------------------------------------------------------------------
/**
 * Redacts long strings but preserves structure so we can inspect nested fields
 * without CloudWatch collapsing everything to `[Object]`.
 */
function scrubBody(body: string | null): unknown {
  if (!body) return undefined;

  const TRUNCATE_AT = 120; // characters

  const truncate = (str: string) =>
    str.length > TRUNCATE_AT ? `${str.slice(0, TRUNCATE_AT)}…` : str;

  try {
    const parsed = JSON.parse(body);

    // Chat-completions heuristic: presence of messages[]
    if (Array.isArray(parsed?.messages)) {
      const safeMessages = parsed.messages.map((m: any) => ({
        role: m.role,
        name: m.name,
        // Show a short preview of content if string / first text part
        preview:
          typeof m.content === "string"
            ? truncate(m.content)
            : Array.isArray(m.content)
            ? truncate(m.content[0]?.text ?? "[non-text]")
            : undefined,
      }));

      const safeTools = Array.isArray(parsed.tools)
        ? parsed.tools.map((t: any) => ({
            // tools can come in various shapes
            name: t?.function?.name ?? t?.name,
            hasParameters: Boolean(
              t?.function?.parameters ?? t?.parameters ?? false,
            ),
          }))
        : undefined;

      return {
        ...parsed,
        messages: safeMessages,
        tools: safeTools,
      };
    }

    // Generic JSON body → truncate long string fields
    return JSON.parse(
      JSON.stringify(parsed, (key, value) => {
        if (typeof value === "string" && value.length > TRUNCATE_AT) {
          return truncate(value);
        }
        return value;
      }),
    );
  } catch {
    // Non-JSON body – just truncate
    return truncate(body);
  }
}

// ---------------------------------------------------------------------
// Lambda handler
// ---------------------------------------------------------------------
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  try {
    // Pretty-print one JSON blob so CloudWatch shows nested structures
    const logPayload = {
      requestId: context.awsRequestId,
      method: event.httpMethod,
      path: event.path,
      qs: event.queryStringParameters,
      body: scrubBody(event.body),
      ts: new Date().toISOString(),
    } as const;

    console.log("Lambda request\n" + JSON.stringify(logPayload, null, 2));

    // Cold‑start boot of Fastify
    if (!proxy) {
      const app = await buildServer();
      proxy = awsLambdaFastify(app, {
        binaryMimeTypes: ["application/octet-stream"],
      });
      await app.ready();
    }

    // Delegate handling to Fastify
    return new Promise((resolve, reject) => {
      proxy!(event, context, (err, res) => {
        if (err) return reject(err);
        resolve(res as APIGatewayProxyResult);
      });
    });
  } catch (err) {
    console.error("Lambda top‑level error", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Internal Server Error",
        message: err instanceof Error ? err.message : "Unknown error",
      }),
    };
  }
};
