import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";
import { hasDatabase } from "../db/pool.js";
import { getAdminPasswordOverrideHash } from "../repositories/security-repository.js";

type AdminAuthResult =
  | {
      ok: true;
      token: string;
      email: string;
      expiresAt: string;
    }
  | {
      ok: false;
      statusCode: number;
      code: string;
      message: string;
    };

type AdminSessionPayload = {
  sub: "admin";
  email: string;
  iat: number;
  exp: number;
};

const adminSessionPrefix = "sekanae_admin_session";
const passwordHashAlgorithm = "pbkdf2_sha256";

function getAdminLoginEmail() {
  return config.ADMIN_LOGIN_EMAIL ?? config.ADMIN_EMAIL;
}

export function getConfiguredAdminEmail() {
  return getAdminLoginEmail();
}

function safeEqual(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  return valueBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(valueBuffer, expectedBuffer);
}

function sign(value: string) {
  if (!config.ADMIN_API_KEY) return undefined;
  return crypto.createHmac("sha256", config.ADMIN_API_KEY).update(value).digest("base64url");
}

function createAdminSessionToken(email: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + config.ADMIN_SESSION_TTL_SECONDS;
  const payload: AdminSessionPayload = {
    sub: "admin",
    email,
    iat: issuedAt,
    exp: expiresAt,
  };
  const payloadPart = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(payloadPart);

  if (!signature) return undefined;

  return {
    token: `${adminSessionPrefix}.${payloadPart}.${signature}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

function verifyAdminSessionToken(token: string) {
  const [prefix, payloadPart, signature] = token.split(".");

  if (prefix !== adminSessionPrefix || !payloadPart || !signature) {
    return false;
  }

  const expectedSignature = sign(payloadPart);

  if (!expectedSignature || !safeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as Partial<AdminSessionPayload>;
    const expectedEmail = getAdminLoginEmail();
    const now = Math.floor(Date.now() / 1000);

    return payload.sub === "admin" && payload.email === expectedEmail && typeof payload.exp === "number" && payload.exp > now;
  } catch {
    return false;
  }
}

function verifyPasswordHash(password: string, storedHash: string) {
  const [algorithm, iterationsValue, salt, hash] = storedHash.split("$");
  const iterations = Number(iterationsValue);

  if (algorithm !== passwordHashAlgorithm || !Number.isInteger(iterations) || iterations < 100_000 || !salt || !hash) {
    return false;
  }

  const derivedHash = crypto.pbkdf2Sync(password, Buffer.from(salt, "base64url"), iterations, 32, "sha256").toString("base64url");
  return safeEqual(derivedHash, hash);
}

async function verifyAdminPassword(password: string) {
  if (hasDatabase()) {
    try {
      const overrideHash = await getAdminPasswordOverrideHash();

      if (overrideHash) {
        return verifyPasswordHash(password, overrideHash);
      }
    } catch {
      // Fall back to the env-based hash if the override table has not been migrated yet.
    }
  }

  if (config.ADMIN_PASSWORD_HASH) {
    return verifyPasswordHash(password, config.ADMIN_PASSWORD_HASH);
  }

  const developmentPassword = config.ADMIN_PASSWORD;

  if (config.NODE_ENV === "production" || !developmentPassword) {
    return false;
  }

  return safeEqual(password, developmentPassword);
}

export function createAdminPasswordHash(password: string) {
  const iterations = 310_000;
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.pbkdf2Sync(password, Buffer.from(salt, "base64url"), iterations, 32, "sha256").toString("base64url");

  return `${passwordHashAlgorithm}$${iterations}$${salt}$${hash}`;
}

function getAdminAuthError(request: FastifyRequest) {
  if (!config.ADMIN_API_KEY) {
    const statusCode = config.NODE_ENV === "production" ? 500 : 401;

    return {
      statusCode,
      error: {
        code: "ADMIN_API_KEY_REQUIRED",
        message: "Set ADMIN_API_KEY before using admin APIs.",
      },
    };
  }

  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;

  if (!token || (!safeEqual(token, config.ADMIN_API_KEY) && !verifyAdminSessionToken(token))) {
    return {
      statusCode: 401,
      error: {
        code: "UNAUTHORIZED",
        message: "A valid admin API token is required.",
      },
    };
  }

  return undefined;
}

export function getAdminActorEmail(request: FastifyRequest) {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;

  if (!token) return getAdminLoginEmail();
  if (config.ADMIN_API_KEY && safeEqual(token, config.ADMIN_API_KEY)) return getAdminLoginEmail();

  const [prefix, payloadPart, signature] = token.split(".");

  if (prefix !== adminSessionPrefix || !payloadPart || !signature) return getAdminLoginEmail();
  if (!verifyAdminSessionToken(token)) return getAdminLoginEmail();

  try {
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as Partial<AdminSessionPayload>;
    return payload.email ?? getAdminLoginEmail();
  } catch {
    return getAdminLoginEmail();
  }
}

export async function authenticateAdminCredentials(email: string, password: string): Promise<AdminAuthResult> {
  if (!config.ADMIN_API_KEY) {
    return {
      ok: false,
      statusCode: config.NODE_ENV === "production" ? 500 : 401,
      code: "ADMIN_API_KEY_REQUIRED",
      message: "Set ADMIN_API_KEY before using admin APIs.",
    };
  }

  const expectedEmail = getAdminLoginEmail();

  if (!expectedEmail || (!config.ADMIN_PASSWORD_HASH && !config.ADMIN_PASSWORD)) {
    return {
      ok: false,
      statusCode: config.NODE_ENV === "production" ? 500 : 401,
      code: "ADMIN_CREDENTIALS_REQUIRED",
      message: "Set ADMIN_LOGIN_EMAIL and ADMIN_PASSWORD_HASH before using admin login.",
    };
  }

  if (email.trim().toLowerCase() !== expectedEmail.toLowerCase() || !(await verifyAdminPassword(password))) {
    return {
      ok: false,
      statusCode: 401,
      code: "UNAUTHORIZED",
      message: "Invalid email or password.",
    };
  }

  const session = createAdminSessionToken(expectedEmail);

  if (!session) {
    return {
      ok: false,
      statusCode: 500,
      code: "ADMIN_SESSION_FAILED",
      message: "Unable to create an admin session.",
    };
  }

  return {
    ok: true,
    token: session.token,
    email: expectedEmail,
    expiresAt: session.expiresAt,
  };
}

export async function requireAdminToken(request: FastifyRequest, reply: FastifyReply) {
  const authError = getAdminAuthError(request);

  if (authError) {
    reply.status(authError.statusCode).send({ error: authError.error });
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const authError = getAdminAuthError(request);

  if (authError) {
    return reply.status(authError.statusCode).send({ error: authError.error });
  }

  if (!hasDatabase()) {
    return reply.status(503).send({
      error: {
        code: "DATABASE_REQUIRED",
        message: "Admin APIs require DATABASE_URL because changes must be persisted.",
      },
    });
  }
}
