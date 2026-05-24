import { randomUUID } from "node:crypto";
import { getPool } from "../db/pool.js";

export type ConciergeStatus = "open" | "in_progress" | "resolved" | "closed";
export type ConciergeReplyStatus = "not_replied" | "reply_needed" | "replied";

export type ConciergeRequest = {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  status: ConciergeStatus;
  adminNotes?: string;
  replyStatus: ConciergeReplyStatus;
  createdAt: string;
  updatedAt: string;
};

type ConciergeRequestRow = {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  status: ConciergeStatus;
  admin_notes: string | null;
  reply_status: ConciergeReplyStatus;
  created_at: Date;
  updated_at: Date;
};

function mapConciergeRequest(row: ConciergeRequestRow): ConciergeRequest {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    topic: row.topic,
    message: row.message,
    status: row.status,
    adminNotes: row.admin_notes ?? undefined,
    replyStatus: row.reply_status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function createConciergeRequestInDatabase(input: {
  name: string;
  email: string;
  topic: string;
  message: string;
}) {
  const pool = getPool();
  const result = await pool.query<ConciergeRequestRow>(
    `
      insert into concierge_requests (id, name, email, topic, message)
      values ($1, $2, $3, $4, $5)
      returning *
    `,
    [randomUUID(), input.name, input.email.toLowerCase(), input.topic, input.message],
  );

  return mapConciergeRequest(result.rows[0]);
}

export async function listConciergeRequestsFromDatabase(input: {
  status?: ConciergeStatus;
  limit?: number;
  offset?: number;
}) {
  const pool = getPool();
  const values: Array<string | number> = [];
  const where: string[] = [];

  if (input.status) {
    values.push(input.status);
    where.push(`status = $${values.length}`);
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;

  const countResult = await pool.query<{ total: string }>(
    `select count(*)::text as total from concierge_requests ${whereSql}`,
    values,
  );
  const result = await pool.query<ConciergeRequestRow>(
    `
      select *
      from concierge_requests
      ${whereSql}
      order by created_at desc
      limit $${values.length + 1}
      offset $${values.length + 2}
    `,
    [...values, limit, offset],
  );

  return {
    items: result.rows.map(mapConciergeRequest),
    total: Number(countResult.rows[0]?.total ?? 0),
  };
}

export async function updateConciergeRequestInDatabase(id: string, input: {
  status?: ConciergeStatus;
  adminNotes?: string;
  replyStatus?: ConciergeReplyStatus;
}) {
  const pool = getPool();
  const result = await pool.query<ConciergeRequestRow>(
    `
      update concierge_requests
      set
        status = coalesce($2, status),
        admin_notes = coalesce($3, admin_notes),
        reply_status = coalesce($4, reply_status),
        updated_at = now()
      where id = $1
      returning *
    `,
    [id, input.status, input.adminNotes, input.replyStatus],
  );

  return result.rows[0] ? mapConciergeRequest(result.rows[0]) : undefined;
}
