import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";
import Fastify from "fastify";

// Only run against a disposable, migrated database: this test archives seed products.
test("product archives persist across admin, storefront, checkout and startup", { skip: !process.env.ARCHIVE_TEST_DATABASE_URL }, async (t) => {
  process.env.DATABASE_URL = process.env.ARCHIVE_TEST_DATABASE_URL;
  process.env.NODE_ENV = "test";
  process.env.ADMIN_API_KEY = "archive-integration-test-key";
  delete process.env.RESEND_API_KEY;
  const runScript = (script: string) => promisify(execFile)(process.execPath, ["--import", "tsx", script], { env: process.env });
  await runScript("api/scripts/seed-catalog.ts");
  const { closePool, getPool } = await import("../src/db/pool.js");
  const { registerAdminCatalogRoutes } = await import("../src/routes/admin-catalog.js");
  const { registerCatalogRoutes } = await import("../src/routes/catalog.js");
  const { registerCartRoutes } = await import("../src/routes/cart.js");
  const { registerErrorHandler } = await import("../src/http.js");
  const app = Fastify();
  registerErrorHandler(app);
  await app.register(registerAdminCatalogRoutes, { prefix: "/api" });
  await app.register(registerCatalogRoutes, { prefix: "/api" });
  await app.register(registerCartRoutes, { prefix: "/api" });
  const headers = { authorization: `Bearer ${process.env.ADMIN_API_KEY}` };
  const list = async (admin = false) => {
    const response = await app.inject({ method: "GET", url: admin ? "/api/admin/products" : "/api/products?limit=100", headers });
    assert.equal(response.statusCode, 200, response.body);
    return response.json().data as Array<{ id: string; slug: string; colors: string[] }>;
  };
  try {
    const product = (await list(true)).find((item) => item.id === "p-001")!;
    assert.ok(product, "Use a fresh disposable database for this test");
    await t.test("unauthorized requests cannot archive products", async () => {
      const response = await app.inject({ method: "DELETE", url: `/api/admin/products/${product.id}` });
      assert.equal(response.statusCode, 401);
      assert.ok((await list()).some((item) => item.id === product.id));
    });
    await t.test("archive removes product from both lists, detail and checkout", async () => {
      const response = await app.inject({ method: "DELETE", url: `/api/admin/products/${product.id}`, headers });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.json().data.archived, true);
      for (const admin of [true, false]) assert.ok(!(await list(admin)).some((item) => item.id === product.id));
      assert.equal((await app.inject({ method: "GET", url: `/api/products/${product.slug}` })).statusCode, 404);
      const quote = await app.inject({ method: "POST", url: "/api/cart/quote", payload: { currency: "EUR", items: [{ productId: product.id, quantity: 1, color: product.colors[0] }] } });
      assert.equal(quote.statusCode, 200, quote.body);
      assert.equal(quote.json().data.canCheckout, false);
      assert.equal((await app.inject({ method: "PATCH", url: `/api/admin/products/${product.id}/inventory`, headers, payload: { quantity: 10 } })).statusCode, 404);
      assert.equal((await app.inject({ method: "DELETE", url: `/api/admin/products/${product.id}`, headers })).statusCode, 404);
      const stored = await getPool().query("select active from products where id=$1", [product.id]);
      assert.equal(stored.rows[0].active, false);
      const audit = await getPool().query("select * from audit_logs where entity_id=$1 and action='archive'", [product.id]);
      assert.equal(audit.rowCount, 1);
    });
    await t.test("a stale product editor cannot republish an archived product", async () => {
      const response = await app.inject({ method: "POST", url: "/api/admin/products", headers, payload: product });
      assert.equal(response.statusCode, 409, response.body);
      assert.match(response.json().error.message, /archived/);
    });
    await t.test("batch archive handles published products and drafts", async () => {
      const others = (await list(true)).slice(0, 2);
      const draft = { ...others[0], status: "draft" };
      assert.equal((await app.inject({ method: "POST", url: "/api/admin/products", headers, payload: draft })).statusCode, 200);
      for (const item of others) {
        const response = await app.inject({ method: "DELETE", url: `/api/admin/products/${item.id}`, headers });
        assert.equal(response.statusCode, 200, response.body);
      }
      for (const admin of [true, false]) assert.ok((await list(admin)).every((item) => !others.some((archived) => archived.id === item.id)));
    });
    await t.test("startup migrations and seeding preserve archives, edits and inventory", async () => {
      const remaining = (await list(true))[0];
      await getPool().query("update products set name='Admin edited name', status='draft' where id=$1", [remaining.id]);
      await getPool().query("update inventory set quantity=3 where product_id=$1", [remaining.id]);
      const before = await getPool().query("select * from products order by id");
      const inventoryBefore = await getPool().query("select * from inventory order by product_id");
      const imagesBefore = await getPool().query("select * from product_images order by product_id, sort_order");
      await runScript("api/scripts/migrate.ts");
      await runScript("api/scripts/seed-catalog.ts");
      await runScript("api/scripts/seed-catalog.ts");
      assert.deepEqual((await getPool().query("select * from products order by id")).rows, before.rows);
      assert.deepEqual((await getPool().query("select * from inventory order by product_id")).rows, inventoryBefore.rows);
      assert.deepEqual((await getPool().query("select * from product_images order by product_id, sort_order")).rows, imagesBefore.rows);
      assert.ok(!(await list(true)).some((item) => item.id === product.id));
      assert.ok(!(await list()).some((item) => item.id === product.id));
    });
  } finally {
    await app.close();
    await closePool();
  }
});
