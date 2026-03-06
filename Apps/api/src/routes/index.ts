import type { FastifyInstance } from 'fastify';
import { registerTenantsRoutes } from './tenants';
import { registerFrameworksRoutes } from './frameworks';
import { registerAuditScopesRoutes } from './audit-scopes';
import { registerRisksRoutes } from './risks';
import { registerControlsRoutes } from './controls';
import { registerTestsRoutes } from './tests';
import { registerEvidenceRoutes } from './evidence';
import { registerConclusionsRoutes } from './conclusions';
import { registerAiRoutes } from './ai';
import { registerMcpRoutes } from './mcp';
import { registerDashboardRoutes } from './dashboard';
import { registerWorkflowRoutes } from '../workflows/workflow-routes';

export async function registerRoutes(app: FastifyInstance) {
  await registerDashboardRoutes(app);
  await registerTenantsRoutes(app);
  await registerWorkflowRoutes(app);
  await registerFrameworksRoutes(app);
  await registerAuditScopesRoutes(app);
  await registerRisksRoutes(app);
  await registerControlsRoutes(app);
  await registerTestsRoutes(app);
  await registerEvidenceRoutes(app);
  await registerConclusionsRoutes(app);
  await registerAiRoutes(app);
  await registerMcpRoutes(app);
}
