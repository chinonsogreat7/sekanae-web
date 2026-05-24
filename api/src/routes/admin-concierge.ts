import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAdminActorEmail, requireAdmin } from "../auth/admin.js";
import { ok } from "../http.js";
import {
  listConciergeRequestsFromDatabase,
  updateConciergeRequestInDatabase,
  type ConciergeReplyStatus,
  type ConciergeStatus,
} from "../repositories/concierge-repository.js";
import { recordAuditLog } from "../repositories/audit-repository.js";

const statuses = ["open", "in_progress", "resolved", "closed"] as const;
const replyStatuses = ["not_replied", "reply_needed", "replied"] as const;

const listQuerySchema = z.object({
  status: z.enum(statuses).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const updateSchema = z.object({
  status: z.enum(statuses).optional(),
  adminNotes: z.string().max(2000).optional(),
  replyStatus: z.enum(replyStatuses).optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one field must be provided.",
});

export async function registerAdminConciergeRoutes(app: FastifyInstance) {
  app.addHook("preValidation", requireAdmin);

  app.get("/admin/concierge", {
    schema: { tags: ["Admin"], summary: "List concierge requests", security: [{ bearerAuth: [] }] },
  }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    const { items, total } = await listConciergeRequestsFromDatabase(query);
    return ok(items, { total, limit: query.limit, offset: query.offset });
  });

  app.patch("/admin/concierge/:id", {
    schema: { tags: ["Admin"], summary: "Update concierge request", security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const payload = updateSchema.parse(request.body);
    const updated = await updateConciergeRequestInDatabase(id, {
      status: payload.status as ConciergeStatus | undefined,
      adminNotes: payload.adminNotes,
      replyStatus: payload.replyStatus as ConciergeReplyStatus | undefined,
    });

    if (!updated) {
      return reply.status(404).send({ error: { code: "CONCIERGE_NOT_FOUND", message: "Concierge request not found." } });
    }

    await recordAuditLog({
      actorEmail: getAdminActorEmail(request),
      action: "update",
      entityType: "concierge_request",
      entityId: id,
      summary: `Updated concierge request ${updated.topic}`,
      metadata: payload,
    });

    return ok(updated);
  });
}
