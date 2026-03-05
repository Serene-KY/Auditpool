import type { FastifyInstance } from 'fastify';
import { registerFrameworksRoutes } from './frameworks';
import { registerAuditScopesRoutes } from './audit-scopes';
import { registerRisksRoutes } from './risks';
import { registerControlsRoutes } from './controls';
import { registerTestsRoutes } from './tests';
import { registerEvidenceRoutes } from './evidence';
import { registerConclusionsRoutes } from './conclusions';

export async function registerRoutes(app: FastifyInstance) {
  await registerFrameworksRoutes(app);
  await registerAuditScopesRoutes(app);
  await registerRisksRoutes(app);
  await registerControlsRoutes(app);
  await registerTestsRoutes(app);
  await registerEvidenceRoutes(app);
  await registerConclusionsRoutes(app);
}
