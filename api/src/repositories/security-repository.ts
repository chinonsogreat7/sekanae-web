import { getPool } from "../db/pool.js";

export async function getAdminPasswordOverrideHash() {
  const pool = getPool();
  const result = await pool.query<{ password_hash: string }>(
    "select password_hash from admin_password_overrides where id = 'primary' limit 1",
  );

  return result.rows[0]?.password_hash;
}

export async function setAdminPasswordOverrideHash(passwordHash: string, actorEmail?: string) {
  const pool = getPool();
  await pool.query(
    `
      insert into admin_password_overrides (id, password_hash, updated_by)
      values ('primary', $1, $2)
      on conflict (id) do update set
        password_hash = excluded.password_hash,
        updated_by = excluded.updated_by,
        updated_at = now()
    `,
    [passwordHash, actorEmail],
  );
}
