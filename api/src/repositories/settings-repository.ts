import { getPool } from "../db/pool.js";

export type StoreSettings = {
  defaultCurrency: string;
  defaultMarketCountry: string;
  defaultShippingAmount: number;
  vatRate: number;
  vatIncluded: boolean;
  storeContactEmail?: string;
  apiPublicUrl: string;
  webOrigin: string;
  updatedAt?: string;
  updatedBy?: string;
};

type SettingRow = {
  key: string;
  value: StoreSettings;
  updated_by: string | null;
  updated_at: Date;
};

const settingsKey = "store";

export async function getStoreSettingsFromDatabase(defaults: StoreSettings): Promise<StoreSettings> {
  const pool = getPool();
  const result = await pool.query<SettingRow>("select * from store_settings where key = $1 limit 1", [settingsKey]);
  const row = result.rows[0];

  if (!row) {
    return defaults;
  }

  return {
    ...defaults,
    ...row.value,
    updatedAt: row.updated_at.toISOString(),
    updatedBy: row.updated_by ?? undefined,
  };
}

export async function upsertStoreSettingsInDatabase(settings: StoreSettings, actorEmail?: string): Promise<StoreSettings> {
  const pool = getPool();
  const result = await pool.query<SettingRow>(
    `
      insert into store_settings (key, value, updated_by)
      values ($1, $2, $3)
      on conflict (key) do update set
        value = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = now()
      returning *
    `,
    [settingsKey, settings, actorEmail],
  );

  return {
    ...result.rows[0].value,
    updatedAt: result.rows[0].updated_at.toISOString(),
    updatedBy: result.rows[0].updated_by ?? undefined,
  };
}
