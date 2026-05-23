import { ZodError } from "zod";
import type { FastifyInstance } from "fastify";

export type ApiResponse<TData, TMeta = Record<string, never>> = {
  data: TData;
  meta?: TMeta;
};

export function ok<TData, TMeta = Record<string, never>>(data: TData, meta?: TMeta): ApiResponse<TData, TMeta> {
  return meta ? { data, meta } : { data };
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "The request payload or query parameters are invalid.",
          details: error.flatten(),
        },
      });
    }

    const maybeHttpError = error as { statusCode?: number; message?: string };
    const statusCode = maybeHttpError.statusCode && maybeHttpError.statusCode >= 400 ? maybeHttpError.statusCode : 500;

    return reply.status(statusCode).send({
      error: {
        code: statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR",
        message: statusCode >= 500 ? "Something went wrong." : maybeHttpError.message ?? "Request failed.",
      },
    });
  });
}
