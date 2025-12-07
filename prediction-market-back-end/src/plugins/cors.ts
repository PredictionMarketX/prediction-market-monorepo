import cors from '@fastify/cors';
import { FastifyInstance } from 'fastify';
import { config } from '../config/index.js';

export async function registerCors(app: FastifyInstance) {
  await app.register(cors, {
    origin: config.cors.origin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Payment', 'X-Payment-Response'],
    exposedHeaders: ['X-Payment-Response'],
    credentials: true,
  });
}
