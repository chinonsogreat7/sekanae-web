import { z } from "zod";

const rawEnv = {
  ...process.env,
  API_PORT: process.env.API_PORT ?? process.env.PORT,
};

const envSchema = z.object({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_PUBLIC_URL: z.string().url().default("http://localhost:4000"),
  ADMIN_API_KEY: z.string().min(16).optional(),
  DATABASE_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().default("Sekanae <orders@sekenae.co>"),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_LOGIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD_HASH: z.string().min(1).optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  ADMIN_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 8),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_SUCCESS_URL: z.string().url().default("http://localhost:5174/checkout/success?session_id={CHECKOUT_SESSION_ID}"),
  STRIPE_CANCEL_URL: z.string().url().default("http://localhost:5174/cart"),
  DEFAULT_CURRENCY: z.enum(["USD", "GBP", "EUR", "NGN", "AED"]).default("EUR"),
  DEFAULT_MARKET_COUNTRY: z.string().length(2).default("MT"),
  DEFAULT_SHIPPING_AMOUNT: z.coerce.number().min(0).default(0),
  VAT_RATE: z.coerce.number().min(0).max(1).default(0.18),
  VAT_INCLUDED: z.coerce.boolean().default(true),
  WEB_ORIGIN: z.string().default("http://localhost:5174"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const config = envSchema.parse(rawEnv);
