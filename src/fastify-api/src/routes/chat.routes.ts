import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ChatRequest, ChatResponse } from '../schemas/chat.js';
import { bedrockChat, bedrockChatStream } from '../services/bedrock.js';

const plugin: FastifyPluginAsyncTypebox = async (f) => {
  // POST /v1/chat/completions - OpenAI compatible endpoint
  f.post(
    '/completions',
    {
      schema: {
        body: ChatRequest,
        response: { 200: ChatResponse },
        tags: ['Chat'],
        summary: 'Create chat completion',
        description: 'Creates a completion for the chat message (OpenAI compatible)'
      },
    },
    async (req, rep) => {
      try {
        /* Streamed completions ------------------------------------ */
        if (req.body.stream) {
          rep.raw.setHeader('Content-Type', 'text/event-stream');
          rep.raw.setHeader('Cache-Control', 'no-cache');
          rep.raw.setHeader('Connection', 'keep-alive');

          const streamId = `chatcmpl-\${Date.now()}`;
          const created = Math.floor(Date.now() / 1000);

          // Send initial data
          rep.sse({ data: JSON.stringify({
            id: streamId,
            object: 'chat.completion.chunk',
            created: created,
            model: req.body.model,
            choices: [{
              index: 0,
              delta: { role: 'assistant' },
              finish_reason: null
            }]
          })});

          for await (const chunk of bedrockChatStream(req.body)) {
            if (chunk) {
              rep.sse({ data: JSON.stringify(chunk) });
            }
          }

          // Send [DONE] message
          rep.sse({ data: '[DONE]' });
          rep.sseContext.source.end();
          return;
        }

        /* Non-streamed completion --------------------------------- */
        const response = await bedrockChat(req.body);
        return response as any;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate completion';
        throw new Error(errorMessage);
      }
    },
  );
};

export default plugin;