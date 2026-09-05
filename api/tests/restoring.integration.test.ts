import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import { products, collections } from "../../packages/catalog/src/index.js";

test("archived products and collections can be found and explicitly restored without changing saved data", { skip: !process.env.RESTORE_TEST_DATABASE_URL }, async () => {
  process.env.DATABASE_URL = process.env.RESTORE_TEST_DATABASE_URL;
  process.env.NODE_ENV = "test";
  process.env.ADMIN_API_KEY = "restore-integration-test-key";
  const { getPool, closePool } = await import("../src/db/pool.js");
  const { registerAdminCatalogRoutes } = await import("../src/routes/admin-catalog.js");
  const { registerCatalogRoutes } = await import("../src/routes/catalog.js");
  const { registerErrorHandler } = await import("../src/http.js");
  const app = Fastify(); registerErrorHandler(app);
  await app.register(registerAdminCatalogRoutes, { prefix: "/api" });
  await app.register(registerCatalogRoutes, { prefix: "/api" });
  const headers = { authorization: `Bearer ${process.env.ADMIN_API_KEY}` };
  const request = (method: "GET" | "POST" | "DELETE", url: string, payload?: unknown) => app.inject({ method, url, headers, ...(payload ? { payload: payload as object } : {}) });
  const stamp = Date.now();
  try {
    for (const status of ["published", "draft"] as const) {
      const item = { ...products[0], id: `restore-${status}-${stamp}`, slug: `restore-${status}-${stamp}`, stock: 7, status };
      assert.equal((await request("POST", "/api/admin/products", item)).statusCode, 200);
      assert.equal((await request("DELETE", `/api/admin/products/${item.id}`)).statusCode, 200);
      const archiveList = await request("GET", "/api/admin/products?archived=true");
      assert.equal(archiveList.statusCode, 200, archiveList.body);
      const archived = archiveList.json().data.find((p: { id: string }) => p.id === item.id);
      assert.equal(archived.status, status);
      assert.equal(archived.stock, 7);
      assert.deepEqual(archived.images, item.images);
      assert.ok(!(await request("GET", "/api/admin/products?archived=false")).json().data.some((p: { id: string }) => p.id === item.id));
      assert.equal((await request("GET", `/api/products/${item.slug}`)).statusCode, 404);
      assert.equal((await request("POST", "/api/admin/products", item)).statusCode, 409);
      assert.equal((await app.inject({ method: "POST", url: `/api/admin/products/${item.id}/restore` })).statusCode, 401);
      const restored = await request("POST", `/api/admin/products/${item.id}/restore`);
      assert.equal(restored.statusCode, 200, restored.body);
      assert.equal(restored.json().data.restored, true);
      const active = (await request("GET", "/api/admin/products")).json().data.find((p: { id: string }) => p.id === item.id);
      assert.deepEqual(active, archived, "unarchive must preserve every saved product field");
      assert.ok(!(await request("GET", "/api/admin/products?archived=true")).json().data.some((p: { id: string }) => p.id === item.id));
      assert.equal((await request("GET", `/api/products/${item.slug}`)).statusCode, status === "published" ? 200 : 404);
      assert.equal((await request("POST", `/api/admin/products/${item.id}/restore`)).statusCode, 404);
    }
    const collection = { ...collections[0], id: `restore-collection-${stamp}`, sortOrder: 27 };
    assert.equal((await request("POST", "/api/admin/collections", collection)).statusCode, 200);
    assert.equal((await request("DELETE", `/api/admin/collections/${collection.id}`)).statusCode, 200);
    assert.equal((await app.inject({ method: "GET", url: "/api/admin/collections?archived=true" })).statusCode, 401);
    assert.equal((await app.inject({ method: "GET", url: "/api/admin/products?archived=true" })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: `/api/admin/collections/${collection.id}/restore` })).statusCode, 401);
    const before = (await getPool().query("select title,description,image_url,cta,sort_order from collections where id=$1", [collection.id])).rows[0];
    assert.ok((await request("GET", "/api/admin/collections?archived=true")).json().data.some((c: { id: string }) => c.id === collection.id));
    assert.ok(!(await request("GET", "/api/collections?archived=true")).json().data.some((c: { id: string }) => c.id === collection.id));
    assert.equal((await request("POST", "/api/admin/collections", collection)).statusCode, 409);
    assert.equal((await request("POST", `/api/admin/collections/${collection.id}/restore`)).statusCode, 200);
    assert.ok((await request("GET", "/api/collections")).json().data.some((c: { id: string }) => c.id === collection.id));
    assert.deepEqual((await getPool().query("select title,description,image_url,cta,sort_order from collections where id=$1", [collection.id])).rows[0], before);
    assert.equal((await request("POST", `/api/admin/collections/${collection.id}/restore`)).statusCode, 404);
    assert.equal((await request("POST", "/api/admin/products/missing/restore")).statusCode, 404);
    assert.equal((await request("GET", "/api/admin/products?archived=invalid")).statusCode, 400);
    assert.equal((await request("GET", "/api/admin/collections?archived=invalid")).statusCode, 400);
    const logs = await getPool().query("select * from audit_logs where action='restore' and entity_id like $1", [`restore-%-${stamp}`]);
    assert.equal(logs.rowCount, 3);
  } finally { await app.close(); await closePool(); }
});
