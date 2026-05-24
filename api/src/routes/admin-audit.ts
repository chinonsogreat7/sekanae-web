import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../auth/admin.js";
import { ok } from "../http.js";
import { listAuditLogs } from "../repositories/audit-repository.js";

const auditQuerySchema = z.object({
  entityType: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function registerAdminAuditRoutes(app: FastifyInstance) {
  app.addHook("preValidation", requireAdmin);

  app.get("/admin/audit", {
    schema: { tags: ["Admin"], summary: "List audit logs", security: [{ bearerAuth: [] }] },
  }, async (request) => {
    const query = auditQuerySchema.parse(request.query);
    const { items, total } = await listAuditLogs(query);

    return ok(items, { total, limit: query.limit, offset: query.offset });
  });
}
