import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { getAdminActorEmail, requireAdmin } from "../auth/admin.js";
import { ok } from "../http.js";
import { getStoreSettingsFromDatabase, upsertStoreSettingsInDatabase, type StoreSettings } from "../repositories/settings-repository.js";
import { recordAuditLog } from "../repositories/audit-repository.js";

const settingsSchema = z.object({
  defaultCurrency: z.enum(["USD", "GBP", "EUR", "NGN", "AED"]),
  defaultMarketCountry: z.string().length(2),
  defaultShippingAmount: z.number().min(0),
  vatRate: z.number().min(0).max(1),
  vatIncluded: z.boolean(),
  storeContactEmail: z.string().email().optional(),
  apiPublicUrl: z.string().url(),
  webOrigin: z.string().min(1),
});

function defaultSettings(): StoreSettings {
  return {
    defaultCurrency: config.DEFAULT_CURRENCY,
    defaultMarketCountry: config.DEFAULT_MARKET_COUNTRY,
    defaultShippingAmount: config.DEFAULT_SHIPPING_AMOUNT,
    vatRate: config.VAT_RATE,
    vatIncluded: config.VAT_INCLUDED,
    storeContactEmail: config.ADMIN_EMAIL,
    apiPublicUrl: config.API_PUBLIC_URL,
    webOrigin: config.WEB_ORIGIN,
  };
}

export async function registerAdminSettingsRoutes(app: FastifyInstance) {
  app.addHook("preValidation", requireAdmin);

  app.get("/admin/settings", {
    schema: { tags: ["Admin"], summary: "Get store settings", security: [{ bearerAuth: [] }] },
  }, async () => ok(await getStoreSettingsFromDatabase(defaultSettings())));

  app.put("/admin/settings", {
    schema: { tags: ["Admin"], summary: "Update store settings", security: [{ bearerAuth: [] }] },
  }, async (request) => {
    const payload = settingsSchema.parse(request.body);
    const settings = await upsertStoreSettingsInDatabase(payload, getAdminActorEmail(request));

    await recordAuditLog({
      actorEmail: getAdminActorEmail(request),
      action: "update",
      entityType: "settings",
      entityId: "store",
      summary: "Updated store settings",
      metadata: payload,
    });

    return ok(settings);
  });

  app.get("/admin/settings/health", {
    schema: { tags: ["Admin"], summary: "Get API environment health", security: [{ bearerAuth: [] }] },
  }, async () => ok({
    database: Boolean(config.DATABASE_URL),
    stripe: Boolean(config.STRIPE_SECRET_KEY && config.STRIPE_WEBHOOK_SECRET),
    email: Boolean(config.RESEND_API_KEY && config.EMAIL_FROM),
    adminEmail: Boolean(config.ADMIN_LOGIN_EMAIL ?? config.ADMIN_EMAIL),
    apiPublicUrl: config.API_PUBLIC_URL,
    webOrigin: config.WEB_ORIGIN,
  }));
}
