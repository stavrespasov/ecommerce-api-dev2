import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { AIJobService } from '../services/AIJobService';

const prisma = new PrismaClient();

function verifyShopifySignature(rawBody: string, hmacHeader: string, secret: string): boolean {
  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
}

export async function webhooksRoutes(app: FastifyInstance) {
  app.post('/webhooks/shopify/products/create', async (request, reply) => {
    const hmac = String(request.headers['x-shopify-hmac-sha256'] || '');
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '';
    const rawBody = JSON.stringify(request.body);
    if (!verifyShopifySignature(rawBody, hmac, secret)) {
      return reply.status(401).send({ data: null, meta: null, error: { code: 'invalid_signature', message: 'Shopify signature invalid' } });
    }

    const payload = request.body as any;
    const clientId = payload.clientId ?? 'unknown';

    await prisma.webhookLog.create({ data: { clientId, provider: 'shopify', eventType: 'products/create', rawPayload: payload } });

    await AIJobService.createJob('PRODUCT_DESCRIPTION', { title: payload.title, category: payload.product_type, attributes: payload }, clientId);
    return reply.send({ data: { success: true }, meta: null, error: null });
  });

  app.post('/webhooks/shopify/orders/create', async (request, reply) => {
    const hmac = String(request.headers['x-shopify-hmac-sha256'] || '');
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '';
    const rawBody = JSON.stringify(request.body);
    if (!verifyShopifySignature(rawBody, hmac, secret)) {
      return reply.status(401).send({ data: null, meta: null, error: { code: 'invalid_signature', message: 'Shopify signature invalid' } });
    }

    const payload = request.body as any;
    const clientId = payload.clientId ?? 'unknown';

    await prisma.webhookLog.create({ data: { clientId, provider: 'shopify', eventType: 'orders/create', rawPayload: payload } });

    await AIJobService.createJob('RETURN_CLASSIFICATION', { reason_text: payload.reason || 'unspecified', order_id: payload.id, product_id: payload.line_items?.[0]?.product_id ?? 'unknown' }, clientId);
    return reply.send({ data: { success: true }, meta: null, error: null });
  });

  app.post('/webhooks/stripe', async (request, reply) => {
    const event = z.object({ type: z.string(), data: z.any() }).parse(request.body);
    await prisma.webhookLog.create({ data: { clientId: (event.data.object.customer as string) || 'unknown', provider: 'stripe', eventType: event.type, rawPayload: event } });
    // TODO: implement invoice.paid and customer.subscription.deleted
    return reply.send({ data: { success: true }, meta: null, error: null });
  });
}
