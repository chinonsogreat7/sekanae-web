import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../http.js";
import {
  CustomerAuthServiceError,
  getCustomerSession,
  requestCustomerLoginCode,
  signOutCustomerSession,
  verifyCustomerLoginCode,
} from "../services/customer-auth-service.js";

const requestCodeSchema = z.object({
  email: z.string().email(),
  purpose: z.enum(["create", "sign-in"]),
  firstName: z.string().min(2).max(80).optional(),
  lastName: z.string().min(2).max(80).optional(),
}).superRefine((payload, context) => {
  if (payload.purpose === "create" && (!payload.firstName || !payload.lastName)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "First name and last name are required to create an account.",
    });
  }
});

const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
});

const tokenBodySchema = z.object({
  token: z.string().min(20),
});

function authError(error: CustomerAuthServiceError) {
  return {
    error: {
      code: error.code,
      message: error.message,
    },
  };
}

export async function registerCustomerAuthRoutes(app: FastifyInstance) {
  app.post("/customer/auth/request-code", {
    schema: {
      tags: ["Customer Auth"],
      summary: "Request customer email code",
      body: {
        type: "object",
        required: ["email", "purpose"],
        properties: {
          email: { type: "string", format: "email" },
          purpose: { type: "string", enum: ["create", "sign-in"] },
          firstName: { type: "string", minLength: 2, maxLength: 80 },
          lastName: { type: "string", minLength: 2, maxLength: 80 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const payload = requestCodeSchema.parse(request.body);
      return ok(await requestCustomerLoginCode(payload));
    } catch (error) {
      if (error instanceof CustomerAuthServiceError) {
        return reply.status(error.statusCode).send(authError(error));
      }

      throw error;
    }
  });

  app.post("/customer/auth/verify-code", {
    schema: {
      tags: ["Customer Auth"],
      summary: "Verify customer email code",
      body: {
        type: "object",
        required: ["email", "code"],
        properties: {
          email: { type: "string", format: "email" },
          code: { type: "string", minLength: 6, maxLength: 6 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const payload = verifyCodeSchema.parse(request.body);
      return ok(await verifyCustomerLoginCode(payload));
    } catch (error) {
      if (error instanceof CustomerAuthServiceError) {
        return reply.status(error.statusCode).send(authError(error));
      }

      throw error;
    }
  });

  app.post("/customer/auth/session", {
    schema: {
      tags: ["Customer Auth"],
      summary: "Validate customer session",
      body: {
        type: "object",
        required: ["token"],
        properties: {
          token: { type: "string", minLength: 20 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { token } = tokenBodySchema.parse(request.body);
      return ok(await getCustomerSession(token));
    } catch (error) {
      if (error instanceof CustomerAuthServiceError) {
        return reply.status(error.statusCode).send(authError(error));
      }

      throw error;
    }
  });

  app.post("/customer/auth/sign-out", {
    schema: {
      tags: ["Customer Auth"],
      summary: "Sign out customer session",
      body: {
        type: "object",
        required: ["token"],
        properties: {
          token: { type: "string", minLength: 20 },
        },
      },
    },
  }, async (request) => {
    const { token } = tokenBodySchema.parse(request.body);
    await signOutCustomerSession(token);
    return ok({ signedOut: true });
  });
}
