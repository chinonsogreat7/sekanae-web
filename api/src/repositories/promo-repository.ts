import { getPool } from "../db/pool.js";

export type PromoCode = {
  code: string;
  percentage: number;
  minimumSubtotal: number;
  expiresAt: string | null;
  active: boolean;
};
type PromoRow = { code: string; percentage: string; minimum_subtotal_cents: number; expires_at: Date | null; active: boolean };
function mapPromo(row: PromoRow): PromoCode {
  return { code: row.code, percentage: Number(row.percentage), minimumSubtotal: row.minimum_subtotal_cents / 100, expiresAt: row.expires_at?.toISOString() ?? null, active: row.active };
}
export async function findPromoCode(code: string) {
  const result = await getPool().query<PromoRow>("select * from promo_codes where code = $1", [code]);
  return result.rows[0] ? mapPromo(result.rows[0]) : undefined;
}
export async function listPromoCodes() {
  const result = await getPool().query<PromoRow>("select * from promo_codes order by created_at desc, code");
  return result.rows.map(mapPromo);
}
export async function savePromoCode(input: PromoCode, create: boolean) {
  const values = [input.code, input.percentage, Math.round(input.minimumSubtotal * 100), input.expiresAt, input.active];
  const result = await getPool().query<PromoRow>(create
    ? `insert into promo_codes (code, percentage, minimum_subtotal_cents, expires_at, active) values ($1,$2,$3,$4,$5) returning *`
    : `update promo_codes set percentage=$2, minimum_subtotal_cents=$3, expires_at=$4, active=$5, updated_at=now() where code=$1 returning *`, values);
  return result.rows[0] ? mapPromo(result.rows[0]) : undefined;
}
