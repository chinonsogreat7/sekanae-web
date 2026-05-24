import { randomUUID } from "node:crypto";
import { getPool } from "../db/pool.js";

export type AuditLog = {
  id: string;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

type AuditLogRow = {
  id: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
};

function mapAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    actorEmail: row.actor_email ?? undefined,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at.toISOString(),
  };
}

export async function recordAuditLog(input: {
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  const pool = getPool();
  const result = await pool.query<AuditLogRow>(
    `
      insert into audit_logs (id, actor_email, action, entity_type, entity_id, summary, metadata)
      values ($1, $2, $3, $4, $5, $6, $7)
      returning *
    `,
    [
      randomUUID(),
      input.actorEmail,
      input.action,
      input.entityType,
      input.entityId,
      input.summary,
      input.metadata ?? null,
    ],
  );

  return mapAuditLog(result.rows[0]);
}

export async function listAuditLogs(input: { limit?: number; offset?: number; entityType?: string }) {
  const pool = getPool();
  const values: Array<string | number> = [];
  const where: string[] = [];

  if (input.entityType) {
    values.push(input.entityType);
    where.push(`entity_type = $${values.length}`);
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;

  const countResult = await pool.query<{ total: string }>(
    `select count(*)::text as total from audit_logs ${whereSql}`,
    values,
  );
  const result = await pool.query<AuditLogRow>(
    `
      select *
      from audit_logs
      ${whereSql}
      order by created_at desc
      limit $${values.length + 1}
      offset $${values.length + 2}
    `,
    [...values, limit, offset],
  );

  return {
    items: result.rows.map(mapAuditLog),
    total: Number(countResult.rows[0]?.total ?? 0),
  };
}
