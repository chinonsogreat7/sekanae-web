import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { hasDatabase } from "../db/pool.js";
import {
  consumeCustomerLoginCode,
  getCustomerProfileByEmail,
  getCustomerSessionByTokenHash,
  getLatestActiveCustomerLoginCode,
  incrementCustomerLoginCodeAttempts,
  insertCustomerLoginCode,
  insertCustomerSession,
  revokeCustomerSession,
  upsertCustomerProfile,
  type CustomerProfile,
} from "../repositories/customer-auth-repository.js";
import { getCustomerByEmailFromDatabase } from "../repositories/customer-repository.js";
import { baseEmailHtml, escapeHtml, sendEmail } from "./email-service.js";

export class CustomerAuthServiceError extends Error {
  constructor(
    public readonly code:
      | "DATABASE_REQUIRED"
      | "PROFILE_NOT_FOUND"
      | "CODE_NOT_FOUND"
      | "CODE_EXPIRED"
      | "CODE_INVALID"
      | "CODE_LOCKED"
      | "SESSION_NOT_FOUND",
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashValue(value: string, salt = "") {
  return createHash("sha256").update(`${value}:${salt}`).digest("hex");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function verifyHash(value: string, salt: string, expectedHash: string) {
  const nextHash = hashValue(value, salt);
  return timingSafeEqual(Buffer.from(nextHash), Buffer.from(expectedHash));
}

function publicCustomer(profile: CustomerProfile) {
  return {
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    createdAt: profile.createdAt,
  };
}

function fallbackNameParts(name: string | undefined, email: string) {
  const trimmedName = name?.trim();

  if (trimmedName) {
    const [firstName, ...rest] = trimmedName.split(/\s+/);

    return {
      firstName: firstName || "SEKANAE",
      lastName: rest.join(" ") || "Customer",
    };
  }

  const localPart = email.split("@")[0]?.trim();

  return {
    firstName: localPart || "SEKANAE",
    lastName: "Customer",
  };
}

async function sendLoginCodeEmail(input: {
  email: string;
  code: string;
  purpose: "create" | "sign-in";
}) {
  const title = input.purpose === "create" ? "Verify your SEKANAE account" : "Your SEKANAE sign-in code";
  const body = `
    <p style="margin:0 0 16px;">Use this one-time code to ${input.purpose === "create" ? "finish creating your SEKANAE account" : "sign in to your SEKANAE account"}.</p>
    <div style="margin:24px 0;padding:20px;background:#2f2420;color:#fff;text-align:center;">
      <div style="font-size:11px;letter-spacing:1.8px;text-transform:uppercase;color:#e8b8ae;">Verification code</div>
      <div style="margin-top:8px;font-size:36px;letter-spacing:8px;font-weight:700;color:#fff;">${escapeHtml(input.code)}</div>
    </div>
    <p style="margin:0;">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
  `;

  return sendEmail({
    to: input.email,
    subject: title,
    html: baseEmailHtml(title, body),
    text: `Your SEKANAE verification code is ${input.code}. It expires in 10 minutes.`,
    template: input.purpose === "create" ? "customer_account_code" : "customer_sign_in_code",
  });
}

export async function requestCustomerLoginCode(input: {
  email: string;
  purpose: "create" | "sign-in";
  firstName?: string;
  lastName?: string;
}) {
  if (!hasDatabase()) {
    throw new CustomerAuthServiceError("DATABASE_REQUIRED", "Customer sign-in requires DATABASE_URL.", 503);
  }

  const email = normalizeEmail(input.email);
  const existingProfile = await getCustomerProfileByEmail(email);
  const existingCustomer = existingProfile ? undefined : await getCustomerByEmailFromDatabase(email);

  if (input.purpose === "sign-in" && !existingProfile && !existingCustomer) {
    throw new CustomerAuthServiceError("PROFILE_NOT_FOUND", "No SEKANAE account was found for that email.", 404);
  }

  const customerNameParts = existingCustomer ? fallbackNameParts(existingCustomer.name, email) : undefined;
  const code = generateCode();
  const salt = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + config.CUSTOMER_LOGIN_CODE_TTL_SECONDS * 1000);

  await insertCustomerLoginCode({
    email,
    firstName: input.firstName?.trim() || customerNameParts?.firstName,
    lastName: input.lastName?.trim() || customerNameParts?.lastName,
    purpose: input.purpose,
    codeHash: hashValue(code, salt),
    codeSalt: salt,
    expiresAt,
  });

  const emailResult = await sendLoginCodeEmail({
    email,
    code,
    purpose: input.purpose,
  });

  return {
    email,
    expiresAt: expiresAt.toISOString(),
    deliveryStatus: emailResult.status,
    devCode: config.NODE_ENV === "production" ? undefined : code,
  };
}

export async function verifyCustomerLoginCode(input: { email: string; code: string }) {
  if (!hasDatabase()) {
    throw new CustomerAuthServiceError("DATABASE_REQUIRED", "Customer sign-in requires DATABASE_URL.", 503);
  }

  const email = normalizeEmail(input.email);
  const codeRecord = await getLatestActiveCustomerLoginCode(email);

  if (!codeRecord) {
    throw new CustomerAuthServiceError("CODE_NOT_FOUND", "Request a new sign-in code.", 404);
  }

  if (new Date(codeRecord.expiresAt).getTime() < Date.now()) {
    throw new CustomerAuthServiceError("CODE_EXPIRED", "This code has expired. Request a new one.", 410);
  }

  if (codeRecord.attempts >= 5) {
    throw new CustomerAuthServiceError("CODE_LOCKED", "Too many attempts. Request a new code.", 429);
  }

  if (!verifyHash(input.code.trim(), codeRecord.codeSalt, codeRecord.codeHash)) {
    await incrementCustomerLoginCodeAttempts(codeRecord.id);
    throw new CustomerAuthServiceError("CODE_INVALID", "The code is incorrect.", 401);
  }

  await consumeCustomerLoginCode(codeRecord.id);

  let profile = await getCustomerProfileByEmail(email);

  if (!profile) {
    if (!codeRecord.firstName || !codeRecord.lastName) {
      throw new CustomerAuthServiceError("PROFILE_NOT_FOUND", "Create an account before signing in.", 404);
    }

    profile = await upsertCustomerProfile({
      email,
      firstName: codeRecord.firstName,
      lastName: codeRecord.lastName,
    });
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.CUSTOMER_SESSION_TTL_SECONDS * 1000);
  await insertCustomerSession({
    email,
    tokenHash: hashToken(token),
    expiresAt,
  });

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    customer: publicCustomer(profile),
  };
}

export async function getCustomerSession(token: string) {
  if (!hasDatabase()) {
    throw new CustomerAuthServiceError("DATABASE_REQUIRED", "Customer sign-in requires DATABASE_URL.", 503);
  }

  const session = await getCustomerSessionByTokenHash(hashToken(token));

  if (!session) {
    throw new CustomerAuthServiceError("SESSION_NOT_FOUND", "Customer session not found.", 401);
  }

  const profile = await getCustomerProfileByEmail(session.email);

  if (!profile) {
    throw new CustomerAuthServiceError("SESSION_NOT_FOUND", "Customer session not found.", 401);
  }

  return {
    token,
    expiresAt: session.expiresAt,
    customer: publicCustomer(profile),
  };
}

export async function signOutCustomerSession(token: string) {
  if (!hasDatabase()) return;
  await revokeCustomerSession(hashToken(token));
}
