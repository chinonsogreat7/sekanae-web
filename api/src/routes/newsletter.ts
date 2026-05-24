import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../http.js";
import {
  NewsletterServiceError,
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
} from "../services/newsletter-service.js";

const subscribeSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(140).optional(),
  source: z.string().min(1).max(80).optional(),
});

const unsubscribeQuerySchema = z.object({
  token: z.string().min(32),
});

const unsubscribeBodySchema = z.object({
  email: z.string().email().optional(),
  token: z.string().min(32).optional(),
}).refine((payload) => payload.email || payload.token, {
  message: "Email or token is required.",
});

function newsletterError(error: NewsletterServiceError) {
  return {
    error: {
      code: error.code,
      message: error.message,
    },
  };
}

export async function registerNewsletterRoutes(app: FastifyInstance) {
  app.post("/newsletter/subscribe", {
    schema: {
      tags: ["Newsletter"],
      summary: "Subscribe to newsletter",
      body: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email" },
          name: { type: "string", minLength: 1, maxLength: 140 },
          source: { type: "string", minLength: 1, maxLength: 80 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const payload = subscribeSchema.parse(request.body);
      const subscriber = await subscribeToNewsletter(payload);

      return ok({
        email: subscriber.email,
        status: subscriber.status,
      });
    } catch (error) {
      if (error instanceof NewsletterServiceError) {
        return reply.status(error.statusCode).send(newsletterError(error));
      }

      throw error;
    }
  });

  app.post("/newsletter/unsubscribe", {
    schema: {
      tags: ["Newsletter"],
      summary: "Unsubscribe from newsletter",
      body: {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
          token: { type: "string", minLength: 32 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const payload = unsubscribeBodySchema.parse(request.body);
      const subscriber = await unsubscribeFromNewsletter(payload);

      if (!subscriber) {
        return reply.status(404).send({
          error: {
            code: "SUBSCRIBER_NOT_FOUND",
            message: "Newsletter subscription not found.",
          },
        });
      }

      return ok({
        email: subscriber.email,
        status: subscriber.status,
      });
    } catch (error) {
      if (error instanceof NewsletterServiceError) {
        return reply.status(error.statusCode).send(newsletterError(error));
      }

      throw error;
    }
  });

  app.get("/newsletter/unsubscribe", {
    schema: {
      tags: ["Newsletter"],
      summary: "Unsubscribe from newsletter link",
      querystring: {
        type: "object",
        required: ["token"],
        properties: {
          token: { type: "string", minLength: 32 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { token } = unsubscribeQuerySchema.parse(request.query);
      const subscriber = await unsubscribeFromNewsletter({ token });

      if (!subscriber) {
        return reply
          .status(404)
          .type("text/html; charset=utf-8")
          .send("<h1>Subscription not found</h1><p>This unsubscribe link is invalid or expired.</p>");
      }

      return reply
        .type("text/html; charset=utf-8")
        .send("<h1>You are unsubscribed</h1><p>You will no longer receive SEKANAE newsletter emails.</p>");
    } catch (error) {
      if (error instanceof NewsletterServiceError) {
        return reply.status(error.statusCode).send(newsletterError(error));
      }

      throw error;
    }
  });
}
