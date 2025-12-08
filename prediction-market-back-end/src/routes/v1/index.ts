import { FastifyInstance } from 'fastify';
import { proposeRoutes } from './propose.js';
import { adminRoutes } from './admin/index.js';

export async function v1Routes(app: FastifyInstance) {
  // Public proposal routes
  await app.register(proposeRoutes, { prefix: '/propose' });

  // Also register as /proposals for GET endpoints
  await app.register(proposeRoutes, { prefix: '/proposals' });

  // Admin routes (should add auth middleware in production)
  await app.register(adminRoutes, { prefix: '/admin' });
}
