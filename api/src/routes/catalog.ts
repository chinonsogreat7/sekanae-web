import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { categories, type ProductCategory } from "../../../packages/catalog/src/index.js";
import { ok } from "../http.js";
import { openApiSchemas } from "../openapi/schemas.js";
import { getProductBySlug, listCollections, listProducts } from "../services/catalog-service.js";

const categoryOptions = categories as [ProductCategory, ...ProductCategory[]];

const productQuerySchema = z.object({
  category: z.enum(categoryOptions).optional(),
  collection: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  material: z.string().min(1).optional(),
  occasion: z.string().min(1).optional(),
  q: z.string().min(1).optional(),
  sort: z.enum(["featured", "new", "price-asc", "price-desc", "name"]).default("featured"),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function registerCatalogRoutes(app: FastifyInstance) {
  app.get("/products", {
    schema: {
      tags: ["Catalog"],
      summary: "List products",
      description: "Returns active storefront products with optional filters, sorting, and pagination metadata.",
      querystring: {
        type: "object",
        properties: {
          category: { type: "string", enum: categories },
          collection: { type: "string" },
          color: { type: "string" },
          material: { type: "string" },
          occasion: { type: "string" },
          q: { type: "string", minLength: 1 },
          sort: { type: "string", enum: ["featured", "new", "price-asc", "price-desc", "name"], default: "featured" },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 24 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
      response: {
        200: openApiSchemas.productListResponse,
        400: openApiSchemas.error,
      },
    },
  }, async (request) => {
    const query = productQuerySchema.parse(request.query);
    const { items, meta } = await listProducts(query);

    return ok(items, meta);
  });

  app.get("/products/:slug", {
    schema: {
      tags: ["Catalog"],
      summary: "Get product by slug",
      params: {
        type: "object",
        required: ["slug"],
        properties: {
          slug: { type: "string", minLength: 1 },
        },
      },
      response: {
        200: openApiSchemas.productResponse,
        404: openApiSchemas.error,
      },
    },
  }, async (request, reply) => {
    const params = z.object({ slug: z.string().min(1) }).parse(request.params);
    const product = await getProductBySlug(params.slug);

    if (!product) {
      return reply.status(404).send({
        error: {
          code: "PRODUCT_NOT_FOUND",
          message: "Product not found.",
        },
      });
    }

    return ok(product);
  });

  app.get("/collections", {
    schema: {
      tags: ["Catalog"],
      summary: "List collections",
      response: {
        200: openApiSchemas.collectionsResponse,
      },
    },
  }, async () => ok(await listCollections()));
}
