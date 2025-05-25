import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ChatRequest, ChatResponse } from '../schemas/chat.js';
import { bedrockChat, bedrockChatStream } from '../services/bedrock.js';

const plugin: FastifyPluginAsyncTypebox = async (f) => {
  // POST /completions
  f.post(
    '/completions',
    {
      schema: {
        body: ChatRequest,
        response: { 200: ChatResponse },
      },
    },
    async (req, rep) => {
      /* Streamed completions ------------------------------------ */
      if (req.body.stream) {
        rep.raw.setHeader('Content-Type', 'text/event-stream');

        for await (const chunk of bedrockChatStream(req.body)) {
          if (chunk) rep.sse({ data: chunk as any });
        }
        rep.sseContext.source.end();              // close SSE cleanly
        return;                                   // stream already flushed
      }

      /* Non-streamed completion --------------------------------- */
      const out = await bedrockChat(req.body);
      return out as any;                          // auto-serialized JSON
    },
  );
};

export default plugin;
