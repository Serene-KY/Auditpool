/**
 * Workflow API routes.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { evaluateWorkflowState } from './workflow-engine';
import type { WorkflowStage } from './workflow-types';
import { WORKFLOW_STAGES } from './workflow-types';

const frameworkIdParamSchema = z.object({ frameworkId: z.string().uuid() });

async function logWorkflowEvent(
  db: PoolClient,
  tenantId: string,
  frameworkId: string,
  previousStage: WorkflowStage,
  newStage: WorkflowStage,
  triggeredBy?: string
): Promise<void> {
  await db!.query(
    `INSERT INTO workflow_events (tenant_id, entity_type, entity_id, event_type, payload, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      tenantId,
      'workflow',
      frameworkId,
      'stage_transition',
      JSON.stringify({
        previous_stage: previousStage,
        new_stage: newStage,
        triggered_by: triggeredBy,
        timestamp: new Date().toISOString(),
      }),
      triggeredBy ?? null,
    ]
  );
}

export async function registerWorkflowRoutes(app: FastifyInstance) {
  app.get(
    '/workflow/:frameworkId/status',
    { preHandler: [app.tenantMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.db || !request.tenantId) {
        return reply.status(400).send({ error: 'Missing tenant context (x-tenant-id header)' });
      }
      const parsed = frameworkIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid framework ID', details: parsed.error.flatten() });
      }
      const { frameworkId } = parsed.data;
      try {
        const status = await evaluateWorkflowState(request.db, request.tenantId, frameworkId);
        return reply.send(status);
      } catch (err) {
        request.log.error(err);
        const message = err instanceof Error ? err.message : 'Failed to evaluate workflow';
        return reply.status(500).send({ error: message });
      }
    }
  );

  app.get(
    '/workflow/:frameworkId/issues',
    { preHandler: [app.tenantMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.db || !request.tenantId) {
        return reply.status(400).send({ error: 'Missing tenant context (x-tenant-id header)' });
      }
      const parsed = frameworkIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid framework ID', details: parsed.error.flatten() });
      }
      const { frameworkId } = parsed.data;
      try {
        const status = await evaluateWorkflowState(request.db, request.tenantId, frameworkId);
        return reply.send({ blocking_issues: status.blocking_issues });
      } catch (err) {
        request.log.error(err);
        const message = err instanceof Error ? err.message : 'Failed to fetch workflow issues';
        return reply.status(500).send({ error: message });
      }
    }
  );

  app.post(
    '/workflow/:frameworkId/advance',
    { preHandler: [app.tenantMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.db || !request.tenantId) {
        return reply.status(400).send({ error: 'Missing tenant context (x-tenant-id header)' });
      }
      const parsed = frameworkIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid framework ID', details: parsed.error.flatten() });
      }
      const { frameworkId } = parsed.data;

      const bodySchema = z.object({ triggered_by: z.string().uuid().optional() });
      const bodyParsed = bodySchema.safeParse(request.body ?? {});
      const triggeredBy = bodyParsed.success ? bodyParsed.data.triggered_by : undefined;

      try {
        const status = await evaluateWorkflowState(request.db, request.tenantId, frameworkId);

        if (!status.can_advance) {
          return reply.status(400).send({
            error: 'Cannot advance: resolve blocking issues first',
            blocking_issues: status.blocking_issues,
          });
        }

        const currentIndex = WORKFLOW_STAGES.indexOf(status.current_stage);
        const nextStage = WORKFLOW_STAGES[currentIndex + 1] as WorkflowStage;

        await logWorkflowEvent(
          request.db!,
          request.tenantId,
          frameworkId,
          status.current_stage,
          nextStage,
          triggeredBy
        );

        const newStatus = await evaluateWorkflowState(request.db, request.tenantId, frameworkId);

        return reply.send({
          previous_stage: status.current_stage,
          new_stage: nextStage,
          status: newStatus,
        });
      } catch (err) {
        request.log.error(err);
        const message = err instanceof Error ? err.message : 'Failed to advance workflow';
        return reply.status(500).send({ error: message });
      }
    }
  );
}
