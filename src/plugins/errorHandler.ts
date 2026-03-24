import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  code: string;
}

export async function errorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: any, request: FastifyRequest, reply: FastifyReply) => {
    app.log.error({ err: error, route: request.routerPath, clientId: (request as any).clientId }, 'Unhandled error');

    if (error instanceof ZodError) {
      const message = error.errors.map((e) => `${e.path.join('.')} ${e.message}`).join(', ');
      const payload: ErrorResponse = {
        statusCode: 400,
        error: 'Bad Request',
        message,
        code: 'validation_error',
      };
      return reply.status(400).send({ data: null, meta: null, error: payload });
    }

    if (error.statusCode && error.code) {
      const payload: ErrorResponse = {
        statusCode: error.statusCode,
        error: error.name || 'Error',
        message: error.message,
        code: error.code,
      };
      return reply.status(error.statusCode).send({ data: null, meta: null, error: payload });
    }

    const payload: ErrorResponse = {
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      code: 'internal_error',
    };
    return reply.status(500).send({ data: null, meta: null, error: payload });
  });
}
