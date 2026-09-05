import assert from "node:assert/strict";
import { test } from "node:test";
import { productImportRowsFromCsv, productCsvRowToProduct } from "../../src/admin/product-csv.js";

const databaseUrl = process.env.CSV_TEST_DATABASE_URL;
test("reviewed CSV imports persist minimal fields and reject duplicates without changing stock", { skip: !databaseUrl }, async () => {
  const target = new URL(databaseUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(target.hostname), "CSV integration tests require a local database");
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = databaseUrl;
  process.env.ADMIN_API_KEY = "csv-integration-local-key";
  const { buildServer } = await import("../src/server.js");
  const { getPool, closePool } = await import("../src/db/pool.js");
  const app = await buildServer();
  app.log.level = "silent";
  const name = `CSV Integration ${Date.now()}`;
  const product = productCsvRowToProduct(productImportRowsFromCsv(`name,category,price,stock,status\n${name},Handbags,12.50,3,draft`)[0]);
  const headers = { authorization: "Bearer csv-integration-local-key" };
  try {
    const unauthorized = await app.inject({ method: "POST", url: "/api/admin/products/import", payload: product });
    assert.equal(unauthorized.statusCode, 401);
    const invalid = await app.inject({ method: "POST", url: "/api/admin/products/import", headers, payload: { ...product, stock: -1 } });
    assert.equal(invalid.statusCode, 400);
    const missingStatus = { ...product };
    delete missingStatus.status;
    assert.equal((await app.inject({ method: "POST", url: "/api/admin/products/import", headers, payload: missingStatus })).statusCode, 400);
    const response = await app.inject({ method: "POST", url: "/api/admin/products/import", headers, payload: product });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().data.stock, 3);
    assert.deepEqual(response.json().data.images, []);
    const duplicate = await app.inject({ method: "POST", url: "/api/admin/products/import", headers, payload: { ...product, stock: 99 } });
    assert.equal(duplicate.statusCode, 409, duplicate.body);
    const conflictingSlug = await app.inject({ method: "POST", url: "/api/admin/products/import", headers, payload: { ...product, id: `${product.id}-different` } });
    assert.equal(conflictingSlug.statusCode, 409, conflictingSlug.body);
    const saved = await getPool().query("select quantity from inventory where product_id=$1", [product.id]);
    assert.equal(saved.rows[0].quantity, 3);
    const catalog = await app.inject({ method: "GET", url: "/api/admin/products", headers });
    assert.equal(catalog.statusCode, 200);
    assert.ok(catalog.json().data.some((item: { id: string }) => item.id === product.id));
    const audit = await getPool().query("select action from audit_logs where entity_id=$1", [product.id]);
    assert.equal(audit.rows[0].action, "csv_import");
  } finally {
    await getPool().query("delete from audit_logs where entity_id=$1", [product.id]);
    await getPool().query("delete from products where id=$1", [product.id]);
    await app.close();
    await closePool();
  }
});
