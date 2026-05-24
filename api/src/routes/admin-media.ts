import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../auth/admin.js";
import { config } from "../config.js";
import { ok } from "../http.js";

function signCloudinaryParams(params: Record<string, string | number>) {
  if (!config.CLOUDINARY_API_SECRET) {
    throw Object.assign(new Error("Cloudinary is not configured."), { statusCode: 503 });
  }

  const payload = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(`${payload}${config.CLOUDINARY_API_SECRET}`)
    .digest("hex");
}

export async function registerAdminMediaRoutes(app: FastifyInstance) {
  app.addHook("preValidation", requireAdmin);

  app.post("/admin/media/cloudinary-signature", {
    schema: {
      tags: ["Admin"],
      summary: "Create signed Cloudinary upload parameters",
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    if (!config.CLOUDINARY_CLOUD_NAME || !config.CLOUDINARY_API_KEY || !config.CLOUDINARY_API_SECRET) {
      throw Object.assign(new Error("Set Cloudinary environment variables before uploading images."), { statusCode: 503 });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = config.CLOUDINARY_UPLOAD_FOLDER;
    const signature = signCloudinaryParams({ folder, timestamp });

    return ok({
      cloudName: config.CLOUDINARY_CLOUD_NAME,
      apiKey: config.CLOUDINARY_API_KEY,
      folder,
      timestamp,
      signature,
      uploadUrl: `https://api.cloudinary.com/v1_1/${config.CLOUDINARY_CLOUD_NAME}/image/upload`,
    });
  });
}
