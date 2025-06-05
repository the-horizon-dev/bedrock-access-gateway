import { FastifyReply, FastifyRequest } from "fastify";
import { bedrockChat, bedrockChatStream } from "../services/bedrock.js";
import { ChatRequest as ChatRequestSchema } from "../schemas/chat.js";

/**
 * Controller responsible for the /v1/chat/completions behaviour.
 * Extracted to keep the route file thin and enable unit‑testing in isolation.
 */
export class CompletionsController {
  /**
   * Main handler wired by the route plugin.
   * Mirrors the OpenAI Chat Completions semantics.
   */
  static async handle(
    req: FastifyRequest<{ Body: typeof ChatRequestSchema }>,
    rep: FastifyReply,
  ) {
    try {
      if (!req.body) {
        return rep.code(400).send({
          error: {
            message: "Missing request body",
            type: "invalid_request_error",
            code: "invalid_body",
          },
        });
      }

      const { stream, stream_options, tools, tool_choice, ...bedrockReq } =
        req.body as any;

      if (stream) {
        rep.raw.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        });
        rep.raw.flushHeaders?.();

        const streamId = `chatcmpl-${Date.now()}`;
        const created = Math.floor(Date.now() / 1000);
        const send = (payload: unknown) =>
          rep.sse({
            data:
              typeof payload === "string" ? payload : JSON.stringify(payload),
          });

        // Initial assistant‑role chunk (OpenAI quirk)
        send({
          id: streamId,
          object: "chat.completion.chunk",
          created,
          model: bedrockReq.model,
          choices: [
            { index: 0, delta: { role: "assistant" }, finish_reason: null },
          ],
        });

        let lastChunk: any;
        let aborted = false;
        const onClose = () => (aborted = true);
        rep.raw.on("close", onClose);

        try {
          for await (const chunk of bedrockChatStream(bedrockReq)) {
            if (aborted) break;
            
            // Handle error chunks
            if ('error' in chunk) {
              send(chunk);
              break;
            }
            
            lastChunk = chunk;
            send(chunk);
          }
          
          // Send usage data if requested
          if (stream_options?.include_usage && lastChunk?.usage) {
            send(lastChunk.usage);
          }
          
          send("[DONE]");
        } catch (err) {
          send({ error: (err as Error).message ?? "stream error" });
        } finally {
          rep.raw.off("close", onClose);
          rep.sseContext.source.end();
        }
        return;
      }

      /* ─────────────────────────── NON‑STREAM REPLY ────────────────────────────── */
      const response = await bedrockChat(bedrockReq);
      return rep.send(response);
    } catch (err) {
      throw err;
    }
  }
}
