import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAdminActorEmail, requireAdmin } from "../auth/admin.js";
import { ok } from "../http.js";
import { recordAuditLog } from "../repositories/audit-repository.js";
import {
  archiveContentItemInDatabase,
  listContentItemsFromDatabase,
  updateContentItemInDatabase,
  upsertContentItemInDatabase,
  type ContentChannel,
  type ContentStatus,
  type ContentType,
} from "../repositories/content-repository.js";

const contentTypes = ["journal", "newsletter", "homepage", "social", "product_story"] as const;
const contentChannels = ["website", "email", "homepage", "instagram"] as const;
const contentStatuses = ["idea", "drafting", "ready", "scheduled", "published", "archived"] as const;

const listQuerySchema = z.object({
  status: z.enum(contentStatuses).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(80),
  offset: z.coerce.number().int().min(0).default(0),
});

const contentItemSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1).max(160),
  contentType: z.enum(contentTypes),
  channel: z.enum(contentChannels),
  status: z.enum(contentStatuses).default("idea"),
  publishAt: z.string().datetime().optional(),
  owner: z.string().max(120).optional(),
  brief: z.string().max(4000).optional(),
  ctaLabel: z.string().max(120).optional(),
  ctaUrl: z.string().url().optional(),
});

const contentPatchSchema = contentItemSchema.partial().omit({ id: true }).refine(
  (payload) => Object.keys(payload).length > 0,
  { message: "At least one field must be provided." },
);

export async function registerAdminContentRoutes(app: FastifyInstance) {
  app.addHook("preValidation", requireAdmin);

  app.get("/admin/content", {
    schema: { tags: ["Admin"], summary: "List content planner items", security: [{ bearerAuth: [] }] },
  }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    const { items, total } = await listContentItemsFromDatabase({
      status: query.status as ContentStatus | undefined,
      limit: query.limit,
      offset: query.offset,
    });

    return ok(items, { total, limit: query.limit, offset: query.offset });
  });

  app.post("/admin/content", {
    schema: { tags: ["Admin"], summary: "Create or update content planner item", security: [{ bearerAuth: [] }] },
  }, async (request) => {
    const payload = contentItemSchema.parse(request.body);
    const saved = await upsertContentItemInDatabase({
      ...payload,
      contentType: payload.contentType as ContentType,
      channel: payload.channel as ContentChannel,
      status: payload.status as ContentStatus,
    });

    await recordAuditLog({
      actorEmail: getAdminActorEmail(request),
      action: "upsert",
      entityType: "content_item",
      entityId: saved.id,
      summary: `Saved content item ${saved.title}`,
      metadata: { status: saved.status, channel: saved.channel, contentType: saved.contentType },
    });

    return ok(saved);
  });

  app.patch("/admin/content/:id", {
    schema: { tags: ["Admin"], summary: "Update content planner item", security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const payload = contentPatchSchema.parse(request.body);
    const updated = await updateContentItemInDatabase(id, {
      ...payload,
      contentType: payload.contentType as ContentType | undefined,
      channel: payload.channel as ContentChannel | undefined,
      status: payload.status as ContentStatus | undefined,
    });

    if (!updated) {
      return reply.status(404).send({ error: { code: "CONTENT_NOT_FOUND", message: "Content item not found." } });
    }

    await recordAuditLog({
      actorEmail: getAdminActorEmail(request),
      action: "update",
      entityType: "content_item",
      entityId: id,
      summary: `Updated content item ${updated.title}`,
      metadata: payload,
    });

    return ok(updated);
  });

  app.delete("/admin/content/:id", {
    schema: { tags: ["Admin"], summary: "Archive content planner item", security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const archived = await archiveContentItemInDatabase(id);

    if (!archived) {
      return reply.status(404).send({ error: { code: "CONTENT_NOT_FOUND", message: "Content item not found." } });
    }

    await recordAuditLog({
      actorEmail: getAdminActorEmail(request),
      action: "archive",
      entityType: "content_item",
      entityId: id,
      summary: `Archived content item ${id}`,
    });

    return ok({ archived: true });
  });
}
