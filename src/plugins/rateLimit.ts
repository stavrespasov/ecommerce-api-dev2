import { FastifyInstance } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';

export async function rateLimitPlugin(app: FastifyInstance) {
  await app.register(fastifyRateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX || '100'),
    timeWindow: Number(process.env.RATE_LIMIT_TIME_WINDOW || '60000'),
    keyGenerator: (request) => {
      return (request as any).apiKeyPrefix || request.ip;
    },
    errorResponseBuilder: function (request, context) {
      return {
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded, retry in ${Math.round(context.ttl / 1000)} seconds`,
        code: 'rate_limit_exceeded',
      };
    },
  });
}
