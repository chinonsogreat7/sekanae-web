import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../http.js";
import { openApiSchemas } from "../openapi/schemas.js";
import { createCheckoutSession, PaymentServiceError } from "../services/payment-service.js";
import { OrderServiceError } from "../services/order-service.js";

const checkoutParamsSchema = z.object({
  id: z.string().uuid(),
});

const checkoutBodySchema = z.object({
  email: z.string().email(),
});

function paymentErrorPayload(error: PaymentServiceError | OrderServiceError) {
  return {
    error: {
      code: error.code,
      message: error.message,
    },
  };
}

export async function registerPaymentRoutes(app: FastifyInstance) {
  app.post("/orders/:id/checkout-session", {
    schema: {
      tags: ["Payments"],
      summary: "Create Stripe Checkout Session",
      description: "Creates a Stripe Checkout Session for a pending order after verifying the customer email.",
      params: openApiSchemas.idParams,
      body: openApiSchemas.checkoutSessionBody,
      response: {
        200: openApiSchemas.checkoutSessionResponse,
        400: openApiSchemas.error,
        404: openApiSchemas.error,
        409: openApiSchemas.error,
        503: openApiSchemas.error,
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = checkoutParamsSchema.parse(request.params);
      const { email } = checkoutBodySchema.parse(request.body);
      return ok(await createCheckoutSession(id, email));
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        if (error.statusCode === 404) return reply.status(404).send(paymentErrorPayload(error));
        if (error.statusCode === 409) return reply.status(409).send(paymentErrorPayload(error));
        return reply.status(503).send(paymentErrorPayload(error));
      }

      if (error instanceof OrderServiceError) {
        return reply.status(503).send(paymentErrorPayload(error));
      }

      throw error;
    }
  });
}
