import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ChatRequest, ChatResponse } from '../schemas/chat.ts';
import { bedrockChat, bedrockChatStream } from '../services/bedrock.ts';

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
      if (req.body.stream) {
        rep.raw.setHeader('Content-Type', 'text/event-stream');
        for await (const chunk of bedrockChatStream(req.body)) {
          // fastify-sse-v2 helper
          rep.sse({ data: chunk });
        }
        return; // stream closed by plugin
      }
      const out = await bedrockChat(req.body);
      return out; // JSON auto-serialized
    },
  );
};

export default plugin;
