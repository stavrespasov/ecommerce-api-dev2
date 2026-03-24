import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AIJobService } from '../services/AIJobService';

const listQuerySchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

export async function jobsRoutes(app: FastifyInstance) {
  app.get('/v1/jobs', {
    schema: {
      querystring: listQuerySchema,
    },
  }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const clientId = (request as any).clientId;
    const jobs = await AIJobService.listJobs(clientId, { status: query.status, type: query.type, limit: query.limit, cursor: query.cursor });
    return reply.send({ data: jobs, meta: { count: jobs.length }, error: null });
  });

  app.get('/v1/jobs/:id', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const clientId = (request as any).clientId;
    const job = await AIJobService.getJob(params.id);
    if (!job || job.clientId !== clientId) {
      return reply.status(404).send({ data: null, meta: null, error: { code: 'not_found', message: 'Job not found' } });
    }
    return reply.send({ data: job, meta: null, error: null });
  });
}
