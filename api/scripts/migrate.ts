import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getPool, closePool } from "../src/db/pool.js";

const migrationFiles = [
  "001_initial_commerce.sql",
  "002_orders.sql",
  "003_email_events.sql",
  "004_market_pricing.sql",
  "005_payment_inventory_events.sql",
  "006_newsletter.sql",
];

async function migrate() {
  const pool = getPool();

  for (const file of migrationFiles) {
    const sql = await readFile(join(process.cwd(), "database", "migrations", file), "utf8");
    await pool.query(sql);
    console.log(`Applied ${file}`);
  }
}

try {
  await migrate();
} finally {
  await closePool();
}
