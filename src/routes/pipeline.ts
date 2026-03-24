import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AIJobService } from '../services/AIJobService';
import csv from 'csv-parse/sync';

const describeSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  attributes: z.record(z.string()).optional(),
});

const returnsSchema = z.object({
  reason_text: z.string().min(1),
  order_id: z.string().min(1),
  product_id: z.string().min(1),
});

export async function pipelineRoutes(app: FastifyInstance) {
  app.post('/v1/products/describe', {
    schema: {
      body: describeSchema,
    },
  }, async (request, reply) => {
    const payload = describeSchema.parse(request.body);
    const clientId = (request as any).clientId;

    const job = await AIJobService.createJob('PRODUCT_DESCRIPTION', { title: payload.title, category: payload.category, attributes: payload.attributes }, clientId);
    return reply.status(201).send({ data: { job_id: job.id, status: job.status, estimated_seconds: job.estimatedSeconds }, meta: null, error: null });
  });

  app.post('/v1/catalog/enrich', {
    schema: {
      consumes: ['multipart/form-data'],
    },
  }, async (request, reply) => {
    const clientId = (request as any).clientId;
    const mp = await request.file({ limits: { fileSize: 5 * 1024 * 1024 } });
    if (!mp) return reply.status(400).send({ data: null, meta: null, error: { code: 'bad_request', message: 'Missing file' } });

    const raw = await mp.toBuffer();
    const text = raw.toString('utf-8');
    const records = csv.parse(text, { columns: true, skip_empty_lines: true });
    if (records.length > 1000) {
      return reply.status(400).send({ data: null, meta: null, error: { code: 'file_too_large', message: 'Max 1000 rows allowed' } });
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    await Promise.all(records.map(async (row: any) => {
      await AIJobService.createJob('CATALOG_ENRICH', { row }, clientId);
    }));

    return reply.status(201).send({ data: { batch_id: batchId, total_jobs: records.length, status: 'processing' }, meta: null, error: null });
  });

  app.post('/v1/returns/classify', {
    schema: {
      body: returnsSchema,
    },
  }, async (request, reply) => {
    const payload = returnsSchema.parse(request.body);
    const clientId = (request as any).clientId;

    const job = await AIJobService.createJob('RETURN_CLASSIFICATION', payload, clientId);
    return reply.status(201).send({ data: { job_id: job.id, status: job.status }, meta: null, error: null });
  });
}
