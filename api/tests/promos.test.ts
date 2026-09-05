import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluatePromo } from "../src/services/promo-service.js";

const promo = { code: "WELCOME10", percentage: 10, minimumSubtotal: 100, expiresAt: null, active: true };
test("percentage discounts round to cents and never exceed merchandise subtotal", () => {
  assert.deepEqual(evaluatePromo(promo, 220, 100), { promoCode: "WELCOME10", discount: 22 });
  assert.equal(evaluatePromo({ ...promo, percentage: 12.5 }, 19.99, 0).discount, 2.5);
  assert.equal(evaluatePromo({ ...promo, percentage: 100 }, 19.99, 0).discount, 19.99);
});
test("unknown, inactive, expired and below-minimum promo codes are rejected", () => {
  assert.throws(() => evaluatePromo(undefined, 220, 0), /invalid/);
  assert.throws(() => evaluatePromo({ ...promo, active: false }, 220, 0), /inactive/);
  assert.throws(() => evaluatePromo({ ...promo, expiresAt: "2026-01-01T00:00:00Z" }, 220, 0, Date.parse("2026-01-01T00:00:00Z")), /expired/);
  assert.throws(() => evaluatePromo(promo, 99.99, 100), /minimum spend/);
  assert.throws(() => evaluatePromo(promo, 0, 0), /available item/);
  assert.equal(evaluatePromo(promo, 100, 100).discount, 10);
});
