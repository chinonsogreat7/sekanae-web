import assert from "node:assert/strict";
import { after, test } from "node:test";
import Fastify from "fastify";

// Keep the regression suite isolated from databases, payment and email services.
delete process.env.DATABASE_URL;
process.env.NODE_ENV = "test";
process.env.DEFAULT_CURRENCY = "EUR";
process.env.DEFAULT_SHIPPING_AMOUNT = "35";
process.env.VAT_RATE = "0.18";
process.env.VAT_INCLUDED = "false";
const { config } = await import("../src/config.js");
const { registerCartRoutes } = await import("../src/routes/cart.js");
const { registerCatalogRoutes } = await import("../src/routes/catalog.js");
const { registerOrderRoutes } = await import("../src/routes/orders.js");
const { registerErrorHandler } = await import("../src/http.js");
const app = Fastify();
registerErrorHandler(app);
await app.register(registerCartRoutes, { prefix: "/api" });
await app.register(registerCatalogRoutes, { prefix: "/api" });
await app.register(registerOrderRoutes, { prefix: "/api" });
after(() => app.close());
const item = { productId: "p-002", quantity: 1, color: "Gold" };
async function quote(items = [item], currency = "EUR") {
  const response = await app.inject({ method: "POST", url: "/api/cart/quote", payload: { currency, items } });
  assert.equal(response.statusCode, 200);
  return response.json().data;
}

test("VAT_INCLUDED=false stays false and quote includes exclusive VAT", async () => {
  assert.equal(config.VAT_INCLUDED, false);
  const result = await quote();
  assert.equal(result.subtotal, 220);
  assert.equal(result.shipping, 35);
  assert.equal(result.tax, 45.9);
  assert.equal(result.total, 300.9);
  assert.equal(result.canCheckout, true);
});
test("inclusive VAT is disclosed without charging it twice", async () => {
  config.VAT_INCLUDED = true;
  try {
    const result = await quote();
    assert.equal(result.taxIncluded, true);
    assert.equal(result.total, 255);
    assert.equal(result.tax, 38.9);
  } finally { config.VAT_INCLUDED = false; }
});
test("quote converts both product prices and shipping once", async () => {
  const result = await quote([item], "USD");
  assert.equal(result.subtotal, 239.8);
  assert.equal(result.shipping, 38.15);
  assert.equal(result.tax, 50.03);
  assert.equal(result.total, 327.98);
});
test("missing products and invalid colors cannot check out", async () => {
  assert.equal((await quote([{ ...item, productId: "missing" }])).canCheckout, false);
  const invalid = await quote([{ ...item, color: "Blue" }]);
  assert.equal(invalid.canCheckout, false);
  assert.equal(invalid.items[0].color, "Blue");
});
test("stock limits apply across repeated lines and colors", async () => {
  const result = await quote([
    { productId: "p-001", quantity: 10, color: "Black" },
    { productId: "p-001", quantity: 10, color: "Ivory" },
  ]);
  assert.equal(result.canCheckout, false);
  assert.ok(result.items.every((line: { isAvailable: boolean }) => !line.isAvailable));
});
test("empty and invalid quantities never become payable", async () => {
  assert.equal((await quote([])).canCheckout, false);
  for (const quantity of [0, -1, 1.5, 100]) {
    const response = await app.inject({ method: "POST", url: "/api/cart/quote", payload: { items: [{ ...item, quantity }] } });
    assert.equal(response.statusCode, 400);
  }
});
test("unknown product links return 404", async () => {
  const response = await app.inject({ method: "GET", url: "/api/products/does-not-exist" });
  assert.equal(response.statusCode, 404);
});
test("guest order schema accepts checkout without an account token", async () => {
  const response = await app.inject({ method: "POST", url: "/api/orders", payload: {
    currency: "EUR", expectedTotal: 300.9,
    customer: { email: "guest@example.com", name: "Test Guest" },
    shippingAddress: { line1: "1 Test Street", city: "Lagos", country: "Nigeria" },
    items: [item], marketingOptIn: false,
  } });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "DATABASE_REQUIRED");
});
