import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../auth/admin.js";
import { ok } from "../http.js";
import {
  getNewsletterAudienceStats,
  listNewsletterAudience,
  NewsletterServiceError,
  sendNewsletterCampaign,
} from "../services/newsletter-service.js";

const subscriberStatuses = ["subscribed", "unsubscribed"] as const;

const subscriberListQuerySchema = z.object({
  status: z.enum(subscriberStatuses).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const sendCampaignSchema = z.object({
  subject: z.string().min(3).max(180),
  previewText: z.string().max(220).optional(),
  html: z.string().min(20).max(50000),
  text: z.string().min(20).max(50000).optional(),
});

function newsletterError(error: NewsletterServiceError) {
  return {
    error: {
      code: error.code,
      message: error.message,
    },
  };
}

export async function registerAdminNewsletterRoutes(app: FastifyInstance) {
  app.addHook("preValidation", requireAdmin);

  app.get("/admin/newsletter/stats", {
    schema: {
      tags: ["Admin"],
      summary: "Get newsletter stats",
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      return ok(await getNewsletterAudienceStats());
    } catch (error) {
      if (error instanceof NewsletterServiceError) {
        return reply.status(error.statusCode).send(newsletterError(error));
      }

      throw error;
    }
  });

  app.get("/admin/newsletter/subscribers", {
    schema: {
      tags: ["Admin"],
      summary: "List newsletter subscribers",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          status: { type: "string", enum: subscriberStatuses },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const query = subscriberListQuerySchema.parse(request.query);
      const { items, total } = await listNewsletterAudience(query);

      return ok(items, { total, limit: query.limit, offset: query.offset });
    } catch (error) {
      if (error instanceof NewsletterServiceError) {
        return reply.status(error.statusCode).send(newsletterError(error));
      }

      throw error;
    }
  });

  app.post("/admin/newsletter/campaigns/send", {
    schema: {
      tags: ["Admin"],
      summary: "Send newsletter campaign",
      description: "Sends a newsletter campaign to subscribed newsletter recipients only.",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["subject", "html"],
        properties: {
          subject: { type: "string", minLength: 3, maxLength: 180 },
          previewText: { type: "string", maxLength: 220 },
          html: { type: "string", minLength: 20, maxLength: 50000 },
          text: { type: "string", minLength: 20, maxLength: 50000 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const payload = sendCampaignSchema.parse(request.body);
      return ok(await sendNewsletterCampaign(payload));
    } catch (error) {
      if (error instanceof NewsletterServiceError) {
        return reply.status(error.statusCode).send(newsletterError(error));
      }

      throw error;
    }
  });
}
