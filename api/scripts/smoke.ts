import assert from "node:assert/strict";
import { buildServer } from "../src/server.js";

const app = await buildServer();

try {
  const health = await app.inject({
    method: "GET",
    url: "/health",
  });
  assert.equal(health.statusCode, 200);
  assert.equal(health.json().status, "ok");

  const cart = await app.inject({
    method: "POST",
    url: "/api/cart/validate",
    payload: {
      items: [{ productId: "p-001", quantity: 1, color: "Black" }],
    },
  });
  assert.equal(cart.statusCode, 200);
  assert.equal(cart.json().data.currency, "EUR");
  assert.equal(cart.json().data.canCheckout, true);

  const order = await app.inject({
    method: "POST",
    url: "/api/orders",
    payload: {
      customer: {
        email: "customer@example.com",
        name: "Ada Customer",
      },
      shippingAddress: {
        line1: "1 Island Road",
        city: "Valletta",
        country: "MT",
      },
      items: [{ productId: "p-001", quantity: 1, color: "Black" }],
    },
  });
  assert.equal(order.statusCode, 503);
  assert.equal(order.json().error.code, "DATABASE_REQUIRED");

  const adminOrders = await app.inject({
    method: "GET",
    url: "/api/admin/orders",
  });
  assert.equal(adminOrders.statusCode, 503);
  assert.equal(adminOrders.json().error.code, "DATABASE_REQUIRED");

  const newsletter = await app.inject({
    method: "POST",
    url: "/api/newsletter/subscribe",
    payload: {
      email: "subscriber@example.com",
      source: "smoke",
    },
  });
  assert.equal(newsletter.statusCode, 503);
  assert.equal(newsletter.json().error.code, "DATABASE_REQUIRED");

  const stripeWebhook = await app.inject({
    method: "POST",
    url: "/api/stripe/webhook",
    headers: {
      "content-type": "application/json",
    },
    payload: {},
  });
  assert.equal(stripeWebhook.statusCode, 503);
  assert.equal(stripeWebhook.json().error.code, "WEBHOOK_SECRET_REQUIRED");

  console.log("Smoke checks passed");
} finally {
  await app.close();
}
