import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { savedWorkSchema, type SavedWork } from "../../../packages/admin/src/workflows.js";
import { getAdminActorEmail, requireAdmin } from "../auth/admin.js";
import { getPool } from "../db/pool.js";
import { ok } from "../http.js";

type WorkRow = { id: string; kind: SavedWork["kind"]; name: string; payload: SavedWork["payload"]; revision: number; updated_at: Date };
const idSchema = z.object({ id: z.string().uuid() });
const revisionSchema = z.object({ revision: z.number().int().positive() });
function mapWork(row: WorkRow) { return { id: row.id, kind: row.kind, name: row.name, payload: row.payload, revision: row.revision, updatedAt: row.updated_at.toISOString() }; }
const schema = { tags: ["Admin"], security: [{ bearerAuth: [] }] };
export async function registerAdminWorkflowRoutes(app: FastifyInstance) {
  app.addHook("preValidation", requireAdmin);
  app.get("/admin/saved-work", { schema }, async (request) => {
    const { kind } = z.object({ kind: z.enum(["order_view", "csv_review"]) }).parse(request.query);
    const result = await getPool().query<WorkRow>("select id,kind,name,revision,updated_at from admin_saved_work where actor_email=$1 and kind=$2 order by updated_at desc", [getAdminActorEmail(request)?.toLowerCase() ?? "admin", kind]);
    return ok(result.rows.map((row) => ({ id: row.id, kind: row.kind, name: row.name, revision: row.revision, updatedAt: row.updated_at.toISOString() })));
  });
  app.get("/admin/saved-work/:id", { schema }, async (request, reply) => {
    const { id } = idSchema.parse(request.params);
    const result = await getPool().query<WorkRow>("select * from admin_saved_work where id=$1 and actor_email=$2", [id, getAdminActorEmail(request)?.toLowerCase() ?? "admin"]);
    if (!result.rows[0]) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Saved work was not found." } });
    return ok(mapWork(result.rows[0]));
  });
  app.post("/admin/saved-work", { schema, bodyLimit: 6 * 1024 * 1024 }, async (request) => {
    const value = savedWorkSchema.parse(request.body);
    const result = await getPool().query<WorkRow>("insert into admin_saved_work (id,actor_email,kind,name,payload) values ($1,$2,$3,$4,$5) returning *", [randomUUID(), getAdminActorEmail(request)?.toLowerCase() ?? "admin", value.kind, value.name, JSON.stringify(value.payload)]);
    return ok(mapWork(result.rows[0]));
  });
  app.put("/admin/saved-work/:id", { schema, bodyLimit: 6 * 1024 * 1024 }, async (request, reply) => {
    const { id } = idSchema.parse(request.params);
    const { revision } = revisionSchema.parse(request.body);
    const value = savedWorkSchema.parse(request.body);
    const result = await getPool().query<WorkRow>("update admin_saved_work set name=$3,payload=$4,revision=revision+1,updated_at=now() where id=$1 and actor_email=$2 and revision=$5 and kind=$6 returning *", [id, getAdminActorEmail(request)?.toLowerCase() ?? "admin", value.name, JSON.stringify(value.payload), revision, value.kind]);
    if (!result.rows[0]) return reply.code(409).send({ error: { code: "SAVED_WORK_CONFLICT", message: "This saved work changed in another tab or was removed. Resume the latest version, or save a new copy." } });
    return ok(mapWork(result.rows[0]));
  });
  app.patch("/admin/saved-work/:id/csv-rows/:rowNumber", { schema }, async (request, reply) => {
    const { id, rowNumber } = z.object({ id: z.string().uuid(), rowNumber: z.coerce.number().int().min(2) }).parse(request.params);
    const resultInput = revisionSchema.extend({ imported: z.boolean(), importError: z.string().max(2000).optional() }).parse(request.body);
    const result = await getPool().query<WorkRow>(`
      update admin_saved_work set
        payload = jsonb_set(payload, '{rows}', (
          select jsonb_agg(case when (item->>'rowNumber')::int = $3
            then (item - 'importError') || $4::jsonb else item end order by ordinal)
          from jsonb_array_elements(payload->'rows') with ordinality as entries(item, ordinal)
        )), revision = revision + 1, updated_at = now()
      where id=$1 and actor_email=$2 and kind='csv_review' and revision=$5
        and exists(select 1 from jsonb_array_elements(payload->'rows') item where (item->>'rowNumber')::int=$3)
      returning id,kind,name,revision,updated_at
    `, [id, getAdminActorEmail(request)?.toLowerCase() ?? "admin", rowNumber, JSON.stringify({ imported: resultInput.imported, ...(resultInput.importError ? { importError: resultInput.importError } : {}) }), resultInput.revision]);
    if (!result.rows[0]) return reply.code(409).send({ error: { code: "SAVED_WORK_CONFLICT", message: "This review changed or was removed. Resume the latest version or save a new copy." } });
    const row = result.rows[0];
    return ok({ id: row.id, kind: row.kind, name: row.name, revision: row.revision, updatedAt: row.updated_at.toISOString() });
  });
  app.delete("/admin/saved-work/:id", { schema }, async (request, reply) => {
    const { id } = idSchema.parse(request.params);
    const { revision } = revisionSchema.parse(request.body);
    const result = await getPool().query("delete from admin_saved_work where id=$1 and actor_email=$2 and revision=$3", [id, getAdminActorEmail(request)?.toLowerCase() ?? "admin", revision]);
    if (!result.rowCount) return reply.code(409).send({ error: { code: "SAVED_WORK_CONFLICT", message: "This saved work has changed. Refresh the list before removing it." } });
    return ok({ removed: true });
  });
}
