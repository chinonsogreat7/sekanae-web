import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, getAdminActorEmail } from "../auth/admin.js";
import { ok } from "../http.js";
import { listPromoCodes, savePromoCode } from "../repositories/promo-repository.js";
import { recordAuditLog } from "../repositories/audit-repository.js";

const codeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{1,40}$/);
const promoSchema = z.object({
  code: codeSchema,
  percentage: z.number().min(0.01).max(100).multipleOf(0.01),
  minimumSubtotal: z.number().min(0).max(10_000_000).multipleOf(0.01).default(0),
  expiresAt: z.string().datetime({ offset: true }).nullable().default(null),
  active: z.boolean().default(true),
});
export async function registerAdminPromoRoutes(app: FastifyInstance) {
  app.addHook("preValidation", requireAdmin);
  app.get("/admin/promos", { schema: { tags: ["Admin"], summary: "List promo codes", security: [{ bearerAuth: [] }] } }, async () => ok(await listPromoCodes()));
  for (const method of ["POST", "PUT"] as const) {
    app.route({ method, url: method === "POST" ? "/admin/promos" : "/admin/promos/:code", schema: { tags: ["Admin"], summary: method === "POST" ? "Create promo code" : "Update promo code", security: [{ bearerAuth: [] }] }, handler: async (request, reply) => {
      const payload = promoSchema.parse(request.body);
      if (method === "PUT" && codeSchema.parse((request.params as { code: string }).code) !== payload.code) {
        return reply.status(400).send({ error: { message: "The promo code cannot be renamed. Create a new code instead." } });
      }
      try {
        const promo = await savePromoCode(payload, method === "POST");
        if (!promo) return reply.status(404).send({ error: { message: "Promo code not found." } });
        await recordAuditLog({ actorEmail: getAdminActorEmail(request), action: method === "POST" ? "create" : "update", entityType: "promo_code", entityId: promo.code, summary: `${method === "POST" ? "Created" : "Updated"} promo code ${promo.code}`, metadata: payload });
        return ok(promo);
      } catch (error) {
        if ((error as { code?: string }).code === "23505") return reply.status(409).send({ error: { message: "This promo code already exists." } });
        throw error;
      }
    } });
  }
}
