import assert from "node:assert/strict";

process.env.ADMIN_API_KEY ??= "local-admin-smoke-key";
process.env.ADMIN_LOGIN_EMAIL ??= "admin@sekanae.co";
process.env.ADMIN_PASSWORD ??= "local-admin-password";

const { buildServer } = await import("../src/server.js");
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
  assert.equal(adminOrders.statusCode, 401);
  assert.equal(adminOrders.json().error.code, "UNAUTHORIZED");

  const adminSession = await app.inject({
    method: "GET",
    url: "/api/admin/session",
  });
  assert.equal(adminSession.statusCode, 401);
  assert.equal(adminSession.json().error.code, "UNAUTHORIZED");

  const badAdminLogin = await app.inject({
    method: "POST",
    url: "/api/admin/session",
    payload: {
      email: "admin@sekanae.co",
      password: "wrong-password",
    },
  });
  assert.equal(badAdminLogin.statusCode, 401);
  assert.equal(badAdminLogin.json().error.code, "UNAUTHORIZED");

  const goodAdminLogin = await app.inject({
    method: "POST",
    url: "/api/admin/session",
    payload: {
      email: "admin@sekanae.co",
      password: "local-admin-password",
    },
  });
  assert.equal(goodAdminLogin.statusCode, 200);
  assert.equal(goodAdminLogin.json().data.authenticated, true);
  assert.equal(typeof goodAdminLogin.json().data.token, "string");

  const authenticatedSession = await app.inject({
    method: "GET",
    url: "/api/admin/session",
    headers: {
      authorization: `Bearer ${goodAdminLogin.json().data.token}`,
    },
  });
  assert.equal(authenticatedSession.statusCode, 200);
  assert.equal(authenticatedSession.json().data.authenticated, true);

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
