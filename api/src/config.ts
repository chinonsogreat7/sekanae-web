import { z } from "zod";

const defaultWebOrigin = process.env.WEB_ORIGIN
  ?? (process.env.NODE_ENV === "production" ? "https://sekanae.co" : "http://localhost:5174");

const rawEnv = {
  ...process.env,
  API_PORT: process.env.API_PORT ?? process.env.PORT,
  WEB_ORIGIN: defaultWebOrigin,
  STRIPE_SUCCESS_URL: process.env.STRIPE_SUCCESS_URL ?? `${defaultWebOrigin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
  STRIPE_CANCEL_URL: process.env.STRIPE_CANCEL_URL ?? `${defaultWebOrigin}/cart`,
};

const envSchema = z.object({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_PUBLIC_URL: z.string().url().default("http://localhost:4000"),
  ADMIN_API_KEY: z.string().min(16).optional(),
  DATABASE_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().default("Sekanae <orders@sekanae.co>"),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_LOGIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD_HASH: z.string().min(1).optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  ADMIN_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 8),
  CUSTOMER_LOGIN_CODE_TTL_SECONDS: z.coerce.number().int().positive().default(10 * 60),
  CUSTOMER_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_SUCCESS_URL: z.string().url(),
  STRIPE_CANCEL_URL: z.string().url(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  CLOUDINARY_UPLOAD_FOLDER: z.string().min(1).default("sekanae/products"),
  DEFAULT_CURRENCY: z.enum(["USD", "GBP", "EUR", "NGN", "AED"]).default("EUR"),
  DEFAULT_MARKET_COUNTRY: z.string().length(2).default("MT"),
  DEFAULT_SHIPPING_AMOUNT: z.coerce.number().min(0).default(0),
  VAT_RATE: z.coerce.number().min(0).max(1).default(0.18),
  VAT_INCLUDED: z.coerce.boolean().default(true),
  WEB_ORIGIN: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const config = envSchema.parse(rawEnv);
