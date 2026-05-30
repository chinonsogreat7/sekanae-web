import type { FastifyInstance } from "fastify";
import { getAdminActorEmail, requireAdmin } from "../auth/admin.js";
import { ok } from "../http.js";
import { recordAuditLog } from "../repositories/audit-repository.js";
import { openApiSchemas } from "../openapi/schemas.js";
import {
  categoryBodySchema,
  collectionBodySchema,
  idParamSchema,
  inventoryBodySchema,
  productBodySchema,
} from "./admin-catalog-schemas.js";
import {
  listAdminProducts,
  listCategoriesInDatabase,
  softDeleteCategoryInDatabase,
  softDeleteCollectionInDatabase,
  softDeleteProductInDatabase,
  updateInventoryInDatabase,
  upsertCategoryInDatabase,
  upsertCollectionInDatabase,
  upsertProductInDatabase,
} from "../repositories/admin-catalog-repository.js";

export async function registerAdminCatalogRoutes(app: FastifyInstance) {
  app.addHook("preValidation", requireAdmin);

  app.get("/admin/products", {
    schema: {
      tags: ["Admin"],
      summary: "List admin products",
      description: "Returns active admin products, including drafts hidden from the storefront.",
      security: [{ bearerAuth: [] }],
      response: {
        200: openApiSchemas.productListResponse,
        401: openApiSchemas.error,
        503: openApiSchemas.error,
      },
    },
  }, async () => {
    const products = await listAdminProducts();

    return ok(products, {
      total: products.length,
      limit: products.length,
      offset: 0,
      categories: [...new Set(products.map((product) => product.category))].sort(),
      colors: [...new Set(products.flatMap((product) => product.colors))].sort(),
      materials: [...new Set(products.map((product) => product.material))].sort(),
      occasions: [...new Set(products.flatMap((product) => product.occasion))].sort(),
      tags: [...new Set(products.flatMap((product) => product.tags ?? []))].sort(),
    });
  });

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
    const savedProduct = await upsertProductInDatabase(product);

    await recordAuditLog({
      actorEmail: getAdminActorEmail(request),
      action: "upsert",
      entityType: "product",
      entityId: savedProduct.id,
      summary: `Saved product ${savedProduct.name}`,
      metadata: { slug: savedProduct.slug, stock: savedProduct.stock },
    });

    return ok(savedProduct);
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

    await recordAuditLog({
      actorEmail: getAdminActorEmail(request),
      action: "update_inventory",
      entityType: "product",
      entityId: id,
      summary: `Updated inventory for ${product.name} to ${product.stock}`,
      metadata: { quantity: product.stock },
    });

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

    await recordAuditLog({
      actorEmail: getAdminActorEmail(request),
      action: "archive",
      entityType: "product",
      entityId: id,
      summary: `Archived product ${id}`,
    });

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
    const savedCollection = await upsertCollectionInDatabase(collection);

    await recordAuditLog({
      actorEmail: getAdminActorEmail(request),
      action: "upsert",
      entityType: "collection",
      entityId: savedCollection.id,
      summary: `Saved collection ${savedCollection.title}`,
    });

    return ok(savedCollection);
  });

  app.get("/admin/categories", {
    schema: {
      tags: ["Admin"],
      summary: "List product categories",
      security: [{ bearerAuth: [] }],
      response: {
        200: openApiSchemas.adminCategoriesResponse,
        401: openApiSchemas.error,
        503: openApiSchemas.error,
      },
    },
  }, async () => ok(await listCategoriesInDatabase()));

  app.post("/admin/categories", {
    schema: {
      tags: ["Admin"],
      summary: "Create or update product category",
      security: [{ bearerAuth: [] }],
      body: openApiSchemas.adminCategoryBody,
      response: {
        200: openApiSchemas.adminCategoryResponse,
        400: openApiSchemas.error,
        401: openApiSchemas.error,
        503: openApiSchemas.error,
      },
    },
  }, async (request) => {
    const category = categoryBodySchema.parse(request.body);
    const savedCategory = await upsertCategoryInDatabase(category);

    await recordAuditLog({
      actorEmail: getAdminActorEmail(request),
      action: "upsert",
      entityType: "category",
      entityId: savedCategory.id,
      summary: `Saved category ${savedCategory.name}`,
    });

    return ok(savedCategory);
  });

  app.delete("/admin/categories/:id", {
    schema: {
      tags: ["Admin"],
      summary: "Archive product category",
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
    const archived = await softDeleteCategoryInDatabase(id);

    if (!archived) {
      return reply.status(404).send({
        error: {
          code: "CATEGORY_NOT_FOUND",
          message: "Category not found.",
        },
      });
    }

    await recordAuditLog({
      actorEmail: getAdminActorEmail(request),
      action: "archive",
      entityType: "category",
      entityId: id,
      summary: `Archived category ${id}`,
    });

    return ok({ archived: true });
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

    await recordAuditLog({
      actorEmail: getAdminActorEmail(request),
      action: "archive",
      entityType: "collection",
      entityId: id,
      summary: `Archived collection ${id}`,
    });

    return ok({ archived: true });
  });
}
