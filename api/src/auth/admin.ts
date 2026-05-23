import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";
import { hasDatabase } from "../db/pool.js";

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!hasDatabase()) {
    return reply.status(503).send({
      error: {
        code: "DATABASE_REQUIRED",
        message: "Admin APIs require DATABASE_URL because changes must be persisted.",
      },
    });
  }

  if (!config.ADMIN_API_KEY) {
    const statusCode = config.NODE_ENV === "production" ? 500 : 401;

    return reply.status(statusCode).send({
      error: {
        code: "ADMIN_API_KEY_REQUIRED",
        message: "Set ADMIN_API_KEY before using admin APIs.",
      },
    });
  }

  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;

  if (token !== config.ADMIN_API_KEY) {
    return reply.status(401).send({
      error: {
        code: "UNAUTHORIZED",
        message: "A valid admin API token is required.",
      },
    });
  }
}
