import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Model, Models } from '../schemas/models.js';
import { listModels } from '../services/bedrock.js';

const plugin: FastifyPluginAsyncTypebox = async (f) => {
  f.get('/', { schema: { response: { 200: Models } } }, async () => listModels());
  f.get<{ Params: { id: string } }>('/:id', { schema: { response: { 200: Model } } }, async (req) => {
    const mdl = (await listModels()).data.find((m: { id: string }) => m.id === req.params.id);
    if (!mdl) throw (f as any).httpErrors.notFound('Unsupported Model Id');
    return mdl;
  });
};

export default plugin;
