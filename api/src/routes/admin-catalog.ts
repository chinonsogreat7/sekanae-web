import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../auth/admin.js";
import { ok } from "../http.js";
import { openApiSchemas } from "../openapi/schemas.js";
import {
  collectionBodySchema,
  idParamSchema,
  inventoryBodySchema,
  productBodySchema,
} from "./admin-catalog-schemas.js";
import {
  softDeleteCollectionInDatabase,
  softDeleteProductInDatabase,
  updateInventoryInDatabase,
  upsertCollectionInDatabase,
  upsertProductInDatabase,
} from "../repositories/admin-catalog-repository.js";

export async function registerAdminCatalogRoutes(app: FastifyInstance) {
  app.addHook("preValidation", requireAdmin);

  app.post("/admin/products", {
    schema: {
      tags: ["Admin"],
      summary: "Create or update product",
      description: "Creates or updates a product, including images, colors, occasions, and inventory.",
      security: [{ bearerAuth: [] }],
      body: openApiSchemas.adminProductBody,
      response: {
        200: openApiSchemas.productResponse,
        400: openApiSchemas.error,
        401: openApiSchemas.error,
        503: openApiSchemas.error,
      },
    },
  }, async (request) => {
    const product = productBodySchema.parse(request.body);
    return ok(await upsertProductInDatabase(product));
  });

  app.patch("/admin/products/:id/inventory", {
    schema: {
      tags: ["Admin"],
      summary: "Update product inventory",
      security: [{ bearerAuth: [] }],
      params: openApiSchemas.idParams,
      body: openApiSchemas.adminInventoryBody,
      response: {
        200: openApiSchemas.productResponse,
        400: openApiSchemas.error,
        401: openApiSchemas.error,
        404: openApiSchemas.error,
        503: openApiSchemas.error,
      },
    },
  }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const { quantity } = inventoryBodySchema.parse(request.body);
    const product = await updateInventoryInDatabase(id, quantity);

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

  app.delete("/admin/products/:id", {
    schema: {
      tags: ["Admin"],
      summary: "Archive product",
      description: "Soft-deletes a product by marking it inactive.",
      security: [{ bearerAuth: [] }],
      params: openApiSchemas.idParams,
      response: {
        200: openApiSchemas.adminArchiveResponse,
        401: openApiSchemas.error,
        404: openApiSchemas.error,
        503: openApiSchemas.error,
      },
    },
  }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const archived = await softDeleteProductInDatabase(id);

    if (!archived) {
      return reply.status(404).send({
        error: {
          code: "PRODUCT_NOT_FOUND",
          message: "Product not found.",
        },
      });
    }

    return ok({ archived: true });
  });

  app.post("/admin/collections", {
    schema: {
      tags: ["Admin"],
      summary: "Create or update collection",
      security: [{ bearerAuth: [] }],
      body: openApiSchemas.adminCollectionBody,
      response: {
        200: openApiSchemas.collectionResponse,
        400: openApiSchemas.error,
        401: openApiSchemas.error,
        503: openApiSchemas.error,
      },
    },
  }, async (request) => {
    const collection = collectionBodySchema.parse(request.body);
    return ok(await upsertCollectionInDatabase(collection));
  });

  app.delete("/admin/collections/:id", {
    schema: {
      tags: ["Admin"],
      summary: "Archive collection",
      description: "Soft-deletes a collection by marking it inactive.",
      security: [{ bearerAuth: [] }],
      params: openApiSchemas.idParams,
      response: {
        200: openApiSchemas.adminArchiveResponse,
        401: openApiSchemas.error,
        404: openApiSchemas.error,
        503: openApiSchemas.error,
      },
    },
  }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const archived = await softDeleteCollectionInDatabase(id);

    if (!archived) {
      return reply.status(404).send({
        error: {
          code: "COLLECTION_NOT_FOUND",
          message: "Collection not found.",
        },
      });
    }

    return ok({ archived: true });
  });
}
