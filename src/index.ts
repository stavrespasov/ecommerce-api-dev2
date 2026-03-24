import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import { authPlugin } from './plugins/auth';
import { rateLimitPlugin } from './plugins/rateLimit';
import { errorHandler } from './plugins/errorHandler';
import { authKeysRoutes } from './routes/authKeys';
import { pipelineRoutes } from './routes/pipeline';
import { jobsRoutes } from './routes/jobs';
import { webhooksRoutes } from './routes/webhooks';

require('dotenv').config();

const app = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } });

app.register(cors, { origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['*'] });
app.register(helmet);
app.register(swagger, {
  routePrefix: '/docs',
  exposeRoute: true,
  swagger: {
    info: {
      title: 'E-commerce AI Agency API',
      version: process.env.APP_VERSION || '0.1.0',
    },
  },
});

app.register(rateLimitPlugin);
app.register(authPlugin);
app.register(authKeysRoutes);
app.register(pipelineRoutes);
app.register(jobsRoutes);
app.register(webhooksRoutes);
app.register(errorHandler);

app.get('/health', async (request, reply) => {
  const uptime = process.uptime();
  return reply.send({ data: { status: 'ok', version: process.env.APP_VERSION || '0.1.0', uptime }, meta: null, error: null });
});

const start = async () => {
  try {
    const port = Number(process.env.PORT || '4000');
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Listening on http://0.0.0.0:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
