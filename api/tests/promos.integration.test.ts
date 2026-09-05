import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import Stripe from "stripe";

// Run only against a disposable, migrated and seeded database (see docs/promo-codes.md).
test("admin promos persist and match cart, orders, VAT and Stripe totals", { skip: !process.env.PROMO_TEST_DATABASE_URL }, async (t) => {
  process.env.DATABASE_URL = process.env.PROMO_TEST_DATABASE_URL;
  process.env.NODE_ENV = "test";
  process.env.ADMIN_API_KEY = "promo-integration-test-key";
  process.env.DEFAULT_SHIPPING_AMOUNT = "35";
  process.env.DEFAULT_CURRENCY = "EUR";
  process.env.VAT_INCLUDED = "false";
  process.env.VAT_RATE = "0.18";
  delete process.env.RESEND_API_KEY;
  delete process.env.ADMIN_EMAIL;
  const { config } = await import("../src/config.js");
  const { getPool, closePool } = await import("../src/db/pool.js");
  const { registerErrorHandler } = await import("../src/http.js");
  const { registerAdminPromoRoutes } = await import("../src/routes/admin-promos.js");
  const { registerCartRoutes } = await import("../src/routes/cart.js");
  const { registerOrderRoutes } = await import("../src/routes/orders.js");
  const { createCheckoutSession } = await import("../src/services/payment-service.js");
  const app = Fastify();
  registerErrorHandler(app);
  await app.register(registerAdminPromoRoutes, { prefix: "/api" });
  await app.register(registerCartRoutes, { prefix: "/api" });
  await app.register(registerOrderRoutes, { prefix: "/api" });
  const code = `TEST_${Date.now()}`;
  const headers = { authorization: `Bearer ${config.ADMIN_API_KEY}` };
  const input = { code, percentage: 10, minimumSubtotal: 100, expiresAt: null, active: true };
  const items = [{ productId: "p-002", quantity: 1, color: "Gold" }];
  const orderIds: string[] = [];
  const quote = (extra = {}) => app.inject({ method: "POST", url: "/api/cart/quote", payload: { currency: "EUR", items, promoCode: code, ...extra } });
  const update = (extra = {}) => app.inject({ method: "PUT", url: `/api/admin/promos/${code}`, headers, payload: { ...input, ...extra } });
  const orderPayload = { customer: { name: "Promo Test", email: "promo-test@example.com" }, shippingAddress: { line1: "1 Test Street", city: "Test", country: "MT" }, items, currency: "EUR", promoCode: code, expectedTotal: 274.94 };
  try {
    await t.test("admin authentication, create, duplicate, list and percentage validation", async () => {
      assert.equal((await app.inject({ method: "POST", url: "/api/admin/promos", payload: input })).statusCode, 401);
      const created = await app.inject({ method: "POST", url: "/api/admin/promos", headers, payload: { ...input, code: code.toLowerCase() } });
      assert.equal(created.statusCode, 200, created.body);
      assert.deepEqual(created.json().data, input);
      assert.equal((await app.inject({ method: "POST", url: "/api/admin/promos", headers, payload: input })).statusCode, 409);
      const list = await app.inject({ method: "GET", url: "/api/admin/promos", headers });
      assert.ok(list.json().data.some((promo: { code: string }) => promo.code === code));
      for (const percentage of [0, -1, 101, 10.001]) assert.equal((await update({ percentage })).statusCode, 400);
      assert.equal((await app.inject({ method: "PUT", url: "/api/admin/promos/MISSING", headers, payload: { ...input, code: "MISSING" } })).statusCode, 404);
    });
    await t.test("quotes ignore client discount amounts, normalize codes and recalculate VAT", async () => {
      const response = await quote({ promoCode: ` ${code.toLowerCase()} `, discount: 220 });
      assert.equal(response.statusCode, 200, response.body);
      const result = response.json().data;
      assert.equal(result.discount, 22);
      assert.equal(result.tax, 41.94);
      assert.equal(result.total, 274.94);
      assert.equal(result.promoCode, code);
      config.VAT_INCLUDED = true;
      const inclusive = (await quote()).json().data;
      assert.equal(inclusive.total, 233);
      assert.equal(inclusive.tax, 35.54);
      config.VAT_INCLUDED = false;
      const usd = (await quote({ currency: "USD" })).json().data;
      assert.equal(usd.discount, 23.98);
      assert.equal(usd.tax, 45.71);
      assert.equal(usd.total, 299.68);
      assert.equal((await quote({ promoCode: "NO_SUCH_CODE" })).statusCode, 400);
    });
    await t.test("saved orders and Stripe receive the exact reviewed discount", async () => {
      const response = await app.inject({ method: "POST", url: "/api/orders", payload: orderPayload });
      assert.equal(response.statusCode, 200, response.body);
      const order = response.json().data;
      orderIds.push(order.id);
      assert.equal(order.discount, 22);
      assert.equal(order.promoCode, code);
      assert.equal(order.total, 274.94);
      const stored = await getPool().query("select discount_cents, promo_code, total_cents from orders where id=$1", [order.id]);
      assert.deepEqual(stored.rows[0], { discount_cents: 2200, promo_code: code, total_cents: 27494 });
      config.STRIPE_SECRET_KEY = "sk_test_mock_only";
      const stripe = new Stripe(config.STRIPE_SECRET_KEY);
      let couponAmount = 0;
      const couponMock = t.mock.method(Object.getPrototypeOf(stripe.coupons), "create", async (params: Stripe.CouponCreateParams) => {
        couponAmount = params.amount_off!;
        assert.equal(couponAmount, 2200);
        assert.equal(params.name, code);
        return { id: "coupon_test" };
      });
      const sessionMock = t.mock.method(Object.getPrototypeOf(stripe.checkout.sessions), "create", async (params: Stripe.Checkout.SessionCreateParams) => {
        assert.deepEqual(params.discounts, [{ coupon: "coupon_test" }]);
        const charge = params.line_items!.reduce((sum, line) => sum + line.quantity! * line.price_data!.unit_amount!, 0) - couponAmount;
        assert.equal(charge, 27494);
        return { id: "session_test", url: "https://example.com/mock-checkout" };
      });
      try { await createCheckoutSession(order.id, order.customer.email); }
      finally { couponMock.mock.restore(); sessionMock.mock.restore(); }
      assert.equal(couponMock.mock.callCount(), 1);
      assert.equal(sessionMock.mock.callCount(), 1);
    });
    await t.test("cart changes, expiry, disabling and changed percentages are revalidated", async () => {
      await update({ minimumSubtotal: 230 });
      assert.equal((await quote()).statusCode, 400);
      assert.equal((await quote({ currency: "USD" })).statusCode, 400);
      await update({ expiresAt: "2020-01-01T00:00:00.000Z" });
      assert.match((await quote()).json().error.message, /expired/);
      await update({ active: false });
      assert.equal((await quote()).statusCode, 400);
      const disabledOrder = await app.inject({ method: "POST", url: "/api/orders", payload: orderPayload });
      assert.equal(disabledOrder.statusCode, 400);
      await update({ percentage: 15 });
      const changed = await app.inject({ method: "POST", url: "/api/orders", payload: orderPayload });
      assert.equal(changed.statusCode, 409);
      assert.equal(changed.json().error.code, "PRICE_CHANGED");
      const removed = (await quote({ promoCode: undefined })).json().data;
      assert.equal(removed.discount, 0);
      assert.equal(removed.total, 300.9);
    });
  } finally {
    for (const id of orderIds) await getPool().query("delete from orders where id=$1", [id]);
    await getPool().query("delete from promo_codes where code=$1", [code]);
    await getPool().query("delete from audit_logs where entity_type='promo_code' and entity_id=$1", [code]);
    await app.close();
    await closePool();
  }
});
