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
  "007_admin_operations.sql",
  "008_product_tags.sql",
  "009_product_categories.sql",
  "010_customer_auth.sql",
  "011_category_images.sql",
  "012_content_items.sql",
  "013_product_status.sql",
  "014_customer_wishlist.sql",
  "015_saved_carts.sql",
  "016_promo_codes.sql",
  "017_admin_saved_work.sql",
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
