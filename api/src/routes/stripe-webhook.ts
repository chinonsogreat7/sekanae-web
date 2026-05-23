import type { FastifyInstance } from "fastify";
import { openApiSchemas } from "../openapi/schemas.js";
import { handleStripeWebhook, PaymentServiceError } from "../services/payment-service.js";

export async function registerStripeWebhookRoutes(app: FastifyInstance) {
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_request, body, done) => {
    done(null, body);
  });

  app.post("/stripe/webhook", {
    schema: {
      tags: ["Payments"],
      summary: "Handle Stripe webhook",
      description: "Receives Stripe webhook events and updates order payment state after signature verification.",
      response: {
        200: openApiSchemas.webhookAckResponse,
        400: openApiSchemas.error,
        503: openApiSchemas.error,
      },
    },
  }, async (request, reply) => {
    try {
      const signature = request.headers["stripe-signature"];
      const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.from(JSON.stringify(request.body));

      return await handleStripeWebhook(
        rawBody,
        Array.isArray(signature) ? signature[0] : signature,
      );
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        return reply.status(error.statusCode === 400 ? 400 : 503).send({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }

      throw error;
    }
  });
}
