import { FastifyInstance } from 'fastify';
import { adminProposalRoutes } from './proposals.js';
import { adminDisputeRoutes } from './disputes.js';

export async function adminRoutes(app: FastifyInstance) {
  // Admin proposal review routes
  await app.register(adminProposalRoutes, { prefix: '/proposals' });

  // Admin dispute review routes
  await app.register(adminDisputeRoutes, { prefix: '/disputes' });
}
