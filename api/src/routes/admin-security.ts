import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateAdminCredentials, createAdminPasswordHash, getAdminActorEmail, getConfiguredAdminEmail, requireAdmin } from "../auth/admin.js";
import { ok } from "../http.js";
import { recordAuditLog } from "../repositories/audit-repository.js";
import { setAdminPasswordOverrideHash } from "../repositories/security-repository.js";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12),
});

export async function registerAdminSecurityRoutes(app: FastifyInstance) {
  app.addHook("preValidation", requireAdmin);

  app.post("/admin/security/password", {
    schema: { tags: ["Admin"], summary: "Change admin password", security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const payload = changePasswordSchema.parse(request.body);
    const email = getConfiguredAdminEmail();

    if (!email) {
      return reply.status(500).send({ error: { code: "ADMIN_EMAIL_REQUIRED", message: "Admin email is not configured." } });
    }

    const auth = await authenticateAdminCredentials(email, payload.currentPassword);

    if (!auth.ok) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Current password is invalid." } });
    }

    await setAdminPasswordOverrideHash(createAdminPasswordHash(payload.newPassword), getAdminActorEmail(request));
    await recordAuditLog({
      actorEmail: getAdminActorEmail(request),
      action: "update",
      entityType: "admin_security",
      entityId: "password",
      summary: "Changed admin password",
    });

    return ok({ changed: true });
  });
}
