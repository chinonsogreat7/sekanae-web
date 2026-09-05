import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../http.js";
import { openApiSchemas } from "../openapi/schemas.js";
import { calculateOrderPricing } from "../services/pricing-service.js";
import { validateCart } from "../services/cart-service.js";

const cartValidationSchema = z.object({
  promoCode: z.string().trim().min(1).max(40).optional(),
  currency: z.enum(["USD", "GBP", "EUR", "NGN", "AED"]).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
        color: z.string().min(1).optional(),
      }),
    )
    .max(50),
});

export async function registerCartRoutes(app: FastifyInstance) {
  app.post("/cart/quote", {
    schema: {
      tags: ["Cart"],
      summary: "Quote cart with current prices, shipping and VAT",
      body: openApiSchemas.cartValidationBody,
    },
  }, async (request) => {
    const payload = cartValidationSchema.parse(request.body);
    const cart = await validateCart(payload);
    const pricing = await calculateOrderPricing(cart.subtotal, cart.currency, payload.promoCode);
    return ok({ ...cart, ...pricing });
  });

  app.post("/cart/validate", {
    schema: {
      tags: ["Cart"],
      summary: "Validate cart",
      description: "Validates submitted cart items against server-side product prices and stock before checkout.",
      body: openApiSchemas.cartValidationBody,
      response: {
        200: openApiSchemas.cartValidationResponse,
        400: openApiSchemas.error,
      },
    },
  }, async (request) => {
    const payload = cartValidationSchema.parse(request.body);
    return ok(await validateCart(payload));
  });
}
