import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { reviewEvidence } from '../ai/reviewer';

const postBodySchema = z.object({
  test_id: z.string().uuid(),
});

const AI_MODEL = 'llama-3.3-70b-versatile';

export async function registerAiRoutes(app: FastifyInstance) {
  app.get('/ai/models', async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return reply.status(500).send({ error: 'GROQ_API_KEY is not set' });
    }
    return reply.send({ models: [{ name: AI_MODEL }] });
  });

  app.post(
    '/ai/review-evidence',
    { preHandler: [app.tenantMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.db || !request.tenantId) {
        return reply.status(400).send({ error: 'Missing tenant context' });
      }

      const parsed = postBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten(),
        });
      }

      const { test_id } = parsed.data;
      const tenantId = request.tenantId;

      try {
        const { result, prompt } = await reviewEvidence(request.db, tenantId, test_id);

        await request.db.query(
          `INSERT INTO ai_logs (tenant_id, agent_name, entity_type, entity_id, prompt, response, model, confidence_score, human_override)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            tenantId,
            'reviewer',
            'test',
            test_id,
            prompt,
            JSON.stringify(result),
            AI_MODEL,
            null,
            false,
          ]
        );

        return reply.send(result);
      } catch (err) {
        request.log.error(err);
        const message = err instanceof Error ? err.message : 'AI review failed';
        return reply.status(500).send({ error: message });
      }
    }
  );
}
