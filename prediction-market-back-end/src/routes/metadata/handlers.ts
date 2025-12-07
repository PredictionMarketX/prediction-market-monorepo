import { FastifyRequest, FastifyReply } from 'fastify';
import { metadataService } from '../../services/metadata.service.js';

interface CreateMetadataBody {
  chainId?: string;
  name: string;
  symbol: string;
  description?: string;
  category?: string;
  resolutionSource?: string;
}

interface GetMetadataParams {
  id: string;
}

export async function createMetadataHandler(
  request: FastifyRequest<{ Body: CreateMetadataBody }>,
  reply: FastifyReply
) {
  const { chainId, name, symbol, description, category, resolutionSource } = request.body;

  const metadata = await metadataService.create({
    chainId,
    name,
    symbol,
    description,
    category,
    resolutionSource,
  });

  // Return the metadata with the full URL that can be used as yes_uri
  const baseUrl = `${request.protocol}://${request.hostname}`;
  const metadataUrl = `${baseUrl}/api/metadata/${metadata.id}`;

  return reply.status(201).send({
    success: true,
    data: {
      id: metadata.id,
      url: metadataUrl,
    },
  });
}

export async function getMetadataHandler(
  request: FastifyRequest<{ Params: GetMetadataParams }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  const metadata = await metadataService.getById(id);

  // Return as standard token metadata JSON format
  return reply.send({
    name: metadata.name,
    symbol: metadata.symbol,
    description: metadata.description || '',
    category: metadata.category || '',
    resolutionSource: metadata.resolutionSource || '',
    createdAt: metadata.createdAt.toISOString(),
  });
}
