import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../auth/admin.js";
import { config } from "../config.js";
import { ok } from "../http.js";

const maxImageUploadBytes = 8 * 1024 * 1024;

const mediaUploadSchema = z.object({
  fileName: z.string().min(1).max(180),
  contentType: z.string().min(1).max(120).refine((value) => value.startsWith("image/"), "Only image files can be uploaded."),
  data: z.string().min(1),
});

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

function assertCloudinaryConfig() {
  if (!config.CLOUDINARY_CLOUD_NAME || !config.CLOUDINARY_API_KEY || !config.CLOUDINARY_API_SECRET) {
    throw Object.assign(new Error("Set Cloudinary environment variables before uploading images."), { statusCode: 503 });
  }
}

function decodeBase64Image(data: string) {
  const base64 = data.includes(",") ? data.split(",").pop() ?? "" : data;
  const buffer = Buffer.from(base64, "base64");

  if (!buffer.length) {
    throw Object.assign(new Error("Choose a valid image file."), { statusCode: 400 });
  }

  if (buffer.byteLength > maxImageUploadBytes) {
    throw Object.assign(new Error("Choose an image smaller than 8 MB."), { statusCode: 413 });
  }

  return buffer;
}

async function uploadImageToCloudinary(input: {
  fileName: string;
  contentType: string;
  buffer: Buffer;
}) {
  assertCloudinaryConfig();

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = config.CLOUDINARY_UPLOAD_FOLDER;
  const signature = signCloudinaryParams({ folder, timestamp });
  const body = new FormData();

  body.append("file", new Blob([input.buffer], { type: input.contentType }), input.fileName);
  body.append("api_key", config.CLOUDINARY_API_KEY ?? "");
  body.append("timestamp", String(timestamp));
  body.append("folder", folder);
  body.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: "POST",
    body,
  });
  const payload = await response.json() as {
    secure_url?: string;
    public_id?: string;
    width?: number;
    height?: number;
    format?: string;
    bytes?: number;
    error?: {
      message?: string;
    };
  };

  if (!response.ok || !payload.secure_url) {
    throw Object.assign(new Error(payload.error?.message ?? "Image upload failed."), { statusCode: response.status >= 400 ? response.status : 502 });
  }

  return {
    url: payload.secure_url,
    publicId: payload.public_id,
    width: payload.width,
    height: payload.height,
    format: payload.format,
    bytes: payload.bytes,
  };
}

export async function registerAdminMediaRoutes(app: FastifyInstance) {
  app.addHook("preValidation", requireAdmin);

  app.post("/admin/media/upload", {
    bodyLimit: Math.ceil(maxImageUploadBytes * 1.45),
    schema: {
      tags: ["Admin"],
      summary: "Upload an admin media image",
      description: "Accepts an image selected in the admin UI, uploads it to Cloudinary from the API server, and returns the hosted image URL.",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["fileName", "contentType", "data"],
        properties: {
          fileName: { type: "string" },
          contentType: { type: "string" },
          data: { type: "string" },
        },
      },
    },
  }, async (request) => {
    const input = mediaUploadSchema.parse(request.body);
    const buffer = decodeBase64Image(input.data);
    const upload = await uploadImageToCloudinary({
      fileName: input.fileName,
      contentType: input.contentType,
      buffer,
    });

    return ok(upload);
  });
}
