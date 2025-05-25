import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Model, Models } from '../schemas/models.ts';
import { listModels } from '../services/bedrock.ts';

const plugin: FastifyPluginAsyncTypebox = async (f) => {
  f.get('/', { schema: { response: { 200: Models } } }, async () => listModels());
  f.get('/:id', { schema: { response: { 200: Model } } }, async (req) => {
    const mdl = (await listModels()).data.find((m) => m.id === req.params.id);
    if (!mdl) throw f.httpErrors.notFound('Unsupported Model Id');
    return mdl;
  });
};

export default plugin;
