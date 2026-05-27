import { randomUUID } from "node:crypto";
import { getPool } from "../db/pool.js";

export type CustomerProfile = {
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerLoginCodeRecord = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  codeHash: string;
  codeSalt: string;
  purpose: "create" | "sign-in";
  attempts: number;
  expiresAt: string;
  consumedAt?: string;
};

export type CustomerSessionRecord = {
  id: string;
  email: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt?: string;
};

type CustomerProfileRow = {
  email: string;
  first_name: string;
  last_name: string;
  created_at: Date;
  updated_at: Date;
};

type CustomerLoginCodeRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  code_hash: string;
  code_salt: string;
  purpose: "create" | "sign-in";
  attempts: number;
  expires_at: Date;
  consumed_at: Date | null;
};

type CustomerSessionRow = {
  id: string;
  email: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
};

function mapProfile(row: CustomerProfileRow): CustomerProfile {
  return {
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapCode(row: CustomerLoginCodeRow): CustomerLoginCodeRecord {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    codeHash: row.code_hash,
    codeSalt: row.code_salt,
    purpose: row.purpose,
    attempts: row.attempts,
    expiresAt: row.expires_at.toISOString(),
    consumedAt: row.consumed_at?.toISOString(),
  };
}

function mapSession(row: CustomerSessionRow): CustomerSessionRecord {
  return {
    id: row.id,
    email: row.email,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at.toISOString(),
    revokedAt: row.revoked_at?.toISOString(),
  };
}

export async function getCustomerProfileByEmail(email: string) {
  const pool = getPool();
  const result = await pool.query<CustomerProfileRow>(
    `select * from customer_profiles where lower(email) = lower($1)`,
    [email],
  );

  return result.rows[0] ? mapProfile(result.rows[0]) : undefined;
}

export async function upsertCustomerProfile(input: { email: string; firstName: string; lastName: string }) {
  const pool = getPool();
  const result = await pool.query<CustomerProfileRow>(
    `
      insert into customer_profiles (email, first_name, last_name)
      values (lower($1), $2, $3)
      on conflict (email) do update set
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        updated_at = now()
      returning *
    `,
    [input.email, input.firstName, input.lastName],
  );

  return mapProfile(result.rows[0]);
}

export async function insertCustomerLoginCode(input: {
  email: string;
  firstName?: string;
  lastName?: string;
  codeHash: string;
  codeSalt: string;
  purpose: "create" | "sign-in";
  expiresAt: Date;
}) {
  const pool = getPool();
  await pool.query(
    `
      update customer_login_codes
      set consumed_at = now()
      where lower(email) = lower($1)
        and consumed_at is null
    `,
    [input.email],
  );

  const result = await pool.query<CustomerLoginCodeRow>(
    `
      insert into customer_login_codes (
        id,
        email,
        first_name,
        last_name,
        code_hash,
        code_salt,
        purpose,
        expires_at
      )
      values ($1, lower($2), $3, $4, $5, $6, $7, $8)
      returning *
    `,
    [
      randomUUID(),
      input.email,
      input.firstName,
      input.lastName,
      input.codeHash,
      input.codeSalt,
      input.purpose,
      input.expiresAt,
    ],
  );

  return mapCode(result.rows[0]);
}

export async function getLatestActiveCustomerLoginCode(email: string) {
  const pool = getPool();
  const result = await pool.query<CustomerLoginCodeRow>(
    `
      select *
      from customer_login_codes
      where lower(email) = lower($1)
        and consumed_at is null
      order by created_at desc
      limit 1
    `,
    [email],
  );

  return result.rows[0] ? mapCode(result.rows[0]) : undefined;
}

export async function incrementCustomerLoginCodeAttempts(id: string) {
  const pool = getPool();
  await pool.query(
    `update customer_login_codes set attempts = attempts + 1 where id = $1`,
    [id],
  );
}

export async function consumeCustomerLoginCode(id: string) {
  const pool = getPool();
  await pool.query(
    `update customer_login_codes set consumed_at = now() where id = $1`,
    [id],
  );
}

export async function insertCustomerSession(input: { email: string; tokenHash: string; expiresAt: Date }) {
  const pool = getPool();
  const result = await pool.query<CustomerSessionRow>(
    `
      insert into customer_sessions (id, email, token_hash, expires_at)
      values ($1, lower($2), $3, $4)
      returning *
    `,
    [randomUUID(), input.email, input.tokenHash, input.expiresAt],
  );

  return mapSession(result.rows[0]);
}

export async function getCustomerSessionByTokenHash(tokenHash: string) {
  const pool = getPool();
  const result = await pool.query<CustomerSessionRow>(
    `
      select *
      from customer_sessions
      where token_hash = $1
        and revoked_at is null
        and expires_at > now()
      limit 1
    `,
    [tokenHash],
  );

  return result.rows[0] ? mapSession(result.rows[0]) : undefined;
}

export async function revokeCustomerSession(tokenHash: string) {
  const pool = getPool();
  await pool.query(
    `
      update customer_sessions
      set revoked_at = now()
      where token_hash = $1
        and revoked_at is null
    `,
    [tokenHash],
  );
}
