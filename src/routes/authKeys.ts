import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { hashApiKey } from '../plugins/auth';

const prisma = new PrismaClient();

const createKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  mode: z.enum(['live', 'test']).default('test'),
});

const apiKeyItemSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  prefix: z.string(),
  name: z.string().nullable(),
  lastUsedAt: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export async function authKeysRoutes(app: FastifyInstance) {
  app.post('/auth/keys', {
    schema: {
      body: createKeySchema.describe('Create API key'),
      response: { 201: z.object({ data: z.object({ id: z.string(), key: z.string(), prefix: z.string() }), meta: z.null(), error: z.null() }).describe('Created') },
    },
  }, async (request, reply) => {
    const payload = createKeySchema.parse(request.body);
    const clientId = (request as any).clientId;

    const rawKey = `${payload.mode === 'live' ? 'sk_live_' : 'sk_test_'}${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = hashApiKey(rawKey);

    const created = await prisma.apiKey.create({
      data: {
        clientId,
        keyHash,
        prefix: payload.mode === 'live' ? 'sk_live_' : 'sk_test_',
        name: payload.name,
      },
    });

    return reply.status(201).send({ data: { id: created.id, key: rawKey, prefix: created.prefix }, meta: null, error: null });
  });

  app.get('/auth/keys', {
    schema: {
      response: { 200: z.object({ data: z.array(apiKeyItemSchema), meta: null, error: null }).describe('List API keys') },
    },
  }, async (request, reply) => {
    const clientId = (request as any).clientId;
    const keys = await prisma.apiKey.findMany({ where: { clientId } });
    return reply.send({ data: keys, meta: null, error: null });
  });

  app.delete('/auth/keys/:id', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const clientId = (request as any).clientId;

    const key = await prisma.apiKey.findUnique({ where: { id: params.id } });
    if (!key || key.clientId !== clientId) {
      return reply.status(404).send({ data: null, meta: null, error: { code: 'not_found', message: 'Key not found' } });
    }

    await prisma.apiKey.update({ where: { id: params.id }, data: { isActive: false } });
    return reply.status(204).send({ data: null, meta: null, error: null });
  });
}
