import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { config } from "./config.js";
import { registerErrorHandler } from "./http.js";
import { registerAdminCatalogRoutes } from "./routes/admin-catalog.js";
import { registerAdminNewsletterRoutes } from "./routes/admin-newsletter.js";
import { registerAdminOrderRoutes } from "./routes/admin-orders.js";
import { registerCartRoutes } from "./routes/cart.js";
import { registerCatalogRoutes } from "./routes/catalog.js";
import { registerNewsletterRoutes } from "./routes/newsletter.js";
import { registerOrderRoutes } from "./routes/orders.js";
import { registerPaymentRoutes } from "./routes/payments.js";
import { registerStripeWebhookRoutes } from "./routes/stripe-webhook.js";

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  await app.register(cors, {
    origin: [config.WEB_ORIGIN, "http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Sekanae Commerce API",
        description: "Backend API for the Sekanae storefront, catalog, cart validation, checkout, and admin workflows.",
        version: "0.1.0",
      },
      servers: [
        { url: "http://localhost:4000", description: "Local development" },
        { url: "https://api.sekenae.co", description: "Production" },
      ],
      tags: [
        { name: "System", description: "Service status and operational endpoints" },
        { name: "Catalog", description: "Products, collections, and storefront catalog data" },
        { name: "Cart", description: "Cart validation and checkout preparation" },
        { name: "Orders", description: "Guest order creation and customer order lookup" },
        { name: "Payments", description: "Stripe checkout and payment webhook workflows" },
        { name: "Newsletter", description: "Newsletter subscription and unsubscribe workflows" },
        { name: "Admin", description: "Protected catalog and inventory management workflows" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });

  registerErrorHandler(app);

  app.get("/health", {
    schema: {
      tags: ["System"],
      summary: "Check API health",
      response: {
        200: {
          type: "object",
          required: ["status", "service", "timestamp"],
          properties: {
            status: { type: "string", enum: ["ok"] },
            service: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
          },
        },
      },
    },
  }, async () => ({
    status: "ok",
    service: "sekanae-api",
    timestamp: new Date().toISOString(),
  }));

  app.get("/openapi.json", {
    schema: {
      hide: true,
    },
  }, async () => app.swagger());

  await app.register(registerCatalogRoutes, { prefix: "/api" });
  await app.register(registerCartRoutes, { prefix: "/api" });
  await app.register(registerOrderRoutes, { prefix: "/api" });
  await app.register(registerNewsletterRoutes, { prefix: "/api" });
  await app.register(registerPaymentRoutes, { prefix: "/api" });
  await app.register(registerStripeWebhookRoutes, { prefix: "/api" });
  await app.register(registerAdminCatalogRoutes, { prefix: "/api" });
  await app.register(registerAdminOrderRoutes, { prefix: "/api" });
  await app.register(registerAdminNewsletterRoutes, { prefix: "/api" });

  return app;
}
