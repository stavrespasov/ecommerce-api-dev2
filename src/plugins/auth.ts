import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const HASH_SALT = process.env.API_KEY_SALT || 'dev-salt';

export function hashApiKey(incoming: string) {
  return crypto.createHmac('sha256', HASH_SALT).update(incoming).digest('hex');
}

export async function authPlugin(app: FastifyInstance) {
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.routerPath?.startsWith('/health') || request.routerPath?.startsWith('/webhooks')) {
      return;
    }

    const authHeader = (request.headers.authorization || '').trim();
    if (!authHeader.startsWith('Bearer ')) {
      void reply.status(401).send({ data: null, meta: null, error: { code: 'unauthorized', message: 'Missing Bearer token' } });
      return;
    }

    const token = authHeader.slice('Bearer '.length);
    if (!token) {
      void reply.status(401).send({ data: null, meta: null, error: { code: 'unauthorized', message: 'Malformed auth token' } });
      return;
    }

    const hash = hashApiKey(token);
    const apiKey = await prisma.apiKey.findFirst({ where: { keyHash: hash, isActive: true } });

    if (!apiKey) {
      void reply.status(401).send({ data: null, meta: null, error: { code: 'invalid_api_key', message: 'API key invalid or revoked' } });
      return;
    }

    (request as any).clientId = apiKey.clientId;
    (request as any).apiKeyPrefix = apiKey.prefix;

    await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });
  });
}
