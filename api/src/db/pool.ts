import pg from "pg";
import { config } from "../config.js";

const { Pool } = pg;

let pool: pg.Pool | undefined;

export function hasDatabase() {
  return Boolean(config.DATABASE_URL);
}

export function getPool() {
  if (!config.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  pool ??= new Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  return pool;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
