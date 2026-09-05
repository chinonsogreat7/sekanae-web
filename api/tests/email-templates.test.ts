import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAdminOrderEmail, buildCartReminderEmail, buildCustomerOrderEmail, buildLoginCodeEmail, buildNewsletterEmail } from "../src/emails/templates.js";
import { safeEmailUrl } from "../src/emails/editorial.js";
import type { Order } from "../src/services/order-service.js";
const order: Order = {
  id: "73e0ca73-55e2-4f4d-8c06-000000000001", customer: { email: "guest@example.com", name: 'Amara <img src=x onerror="bad()">' },
  currency: "EUR", subtotal: 860, discount: 86, promoCode: "WELCOME<10>", shipping: 35, tax: 123.41, total: 809, taxRate: 0.18, taxIncluded: true,
  status: "paid", paymentStatus: "paid", shippingAddress: { line1: "12 Palm & Rose Avenue", line2: "Apartment <2>", city: "Lagos", country: "Nigeria" },
  items: [{ id: "i-1", productId: "p-001", slug: "bag", name: "Monde & Gold", color: "Espresso", quantity: 1, unitPrice: 640, lineTotal: 640 }, { id: "i-2", productId: "p-002", slug: "hoops", name: "Aure Hoops", color: "Gold", quantity: 1, unitPrice: 220, lineTotal: 220 }],
  createdAt: "2026-09-05T12:00:00.000Z", updatedAt: "2026-09-05T12:00:00.000Z",
};
const context = { webOrigin: "https://sekanae.example", images: new Map([["p-001", "https://cdn.example/bag.jpg?w=600&fit=crop"]]) };
test("Editorial order emails use persisted totals and escape customer, address and promo text", () => {
  const email = buildCustomerOrderEmail(order, true, context);
  assert.match(email.html, /A beautiful/);
  assert.match(email.html, /choice\./);
  assert.match(email.html, /€809\.00/);
  assert.match(email.html, /Includes €123\.41 VAT \(18%\)/);
  assert.match(email.html, /−€86\.00/);
  assert.match(email.html, /WELCOME&lt;10&gt;/);
  assert.match(email.html, /Palm &amp; Rose/);
  assert.match(email.html, /Apartment &lt;2&gt;/);
  assert.ok(!email.html.includes('<img src=x'));
  assert.match(email.text, /VAT included: €123\.41/);
  assert.match(email.text, /Total paid: €809\.00/);
  assert.match(email.html, /src="https:\/\/cdn.example\/bag.jpg\?w=600&amp;fit=crop"/);
  assert.equal((email.html.match(/<img /g) ?? []).length, 1);
});
test("exclusive VAT, no promo and free shipping display without recomputing order amounts", () => {
  const email = buildCustomerOrderEmail({ ...order, discount: 0, promoCode: undefined, taxIncluded: false, shipping: 0, tax: 154.8, total: 1014.8 }, true, { webOrigin: context.webOrigin });
  assert.match(email.html, /VAT \(18%\)/);
  assert.match(email.html, /€154\.80/);
  assert.match(email.html, /€1,014\.80/);
  assert.match(email.html, /Complimentary/);
  assert.ok(!email.html.includes('Includes €'));
  assert.ok(!email.html.includes('Promo'));
  assert.ok(!email.html.includes('<img '));
});
test("pending email never claims payment or inventory reservation", () => {
  const email = buildCustomerOrderEmail({ ...order, status: "pending", paymentStatus: "unpaid" }, false, context);
  assert.match(email.html, /Payment pending/);
  assert.match(email.html, /Order total/);
  assert.ok(!email.html.includes('Total paid'));
  assert.ok(!email.html.includes('reserved'));
  assert.match(email.html, /https:\/\/sekanae.example\/client-care/);
});
test("unsafe images are omitted and product data never falls back to a different item", () => {
  for (const image of ['javascript:alert(1)', 'data:image/svg+xml,test', 'https://user:pass@example.com/x']) {
    const html = buildCustomerOrderEmail(order, true, { ...context, images: new Map([["p-001", image]]) }).html;
    assert.ok(!html.includes('<img '));
    assert.match(html, /Monde &amp; Gold/);
    assert.match(html, /Aure Hoops/);
  }
  assert.equal(safeEmailUrl('/images/bag.jpg', context.webOrigin), 'https://sekanae.example/images/bag.jpg');
});
test("login and account emails show the real TTL and do not expose the code in preheader", () => {
  for (const purpose of ["create", "sign-in"] as const) {
    const email = buildLoginCodeEmail({ email: "guest@example.com", code: "482619", purpose, ttlSeconds: 300, webOrigin: context.webOrigin });
    assert.match(email.html, /482619/);
    assert.match(email.html, /5 minutes/);
    assert.match(email.text, /5 minutes/);
    assert.equal(email.html.slice(0, email.html.indexOf('<table')).includes('482619'), false);
    assert.equal(email.template, purpose === 'create' ? 'customer_account_code' : 'customer_sign_in_code');
  }
});
test("newsletter content, escaped preview text and personalized unsubscribe survive the frame", () => {
  const html = buildNewsletterEmail({ email: 'reader+<tag>@example.com', subject: 'The <new> edit', previewText: 'A little <script> surprise', html: '<h2>Our new edit</h2><p>Considered arrivals.</p>', unsubscribeUrl: 'https://api.example/unsubscribe?token=a%26b', webOrigin: context.webOrigin });
  assert.match(html, /The &lt;new&gt; edit/);
  assert.match(html, /A little &lt;script&gt; surprise/);
  assert.match(html, /<h2>Our new edit<\/h2>/);
  assert.match(html, /reader\+&lt;tag&gt;@example.com/);
  assert.match(html, /href="https:\/\/api.example\/unsubscribe\?token=a%26b"/);
});
test("both reminders preserve opt-out links, quantities and checkout qualification", () => {
  for (const final of [false, true]) {
    const email = buildCartReminderEmail({ email: "guest@example.com", final, items: [{ name: "Hoops", color: "Gold", quantity: 2, lineTotal: 440, href: "/product/hoops" }], currency: "EUR", unsubscribeUrl: "https://api.example/cart/unsubscribe?token=saved", webOrigin: context.webOrigin });
    assert.match(email.html, /Qty 2/);
    assert.ok(email.html.includes('href="https://sekanae.example/product/hoops"'));
    assert.match(email.html, /€440\.00/);
    assert.match(email.html, /Prices and availability are confirmed at checkout/);
    assert.match(email.html, /Stop cart reminders/);
    assert.match(email.text, /https:\/\/api.example\/cart\/unsubscribe\?token=saved/);
    assert.equal(email.template, final ? 'abandoned_cart_final' : 'abandoned_cart_first');
  }
});
test("admin notifications retain status and direct staff to orders", () => {
  const email = buildAdminOrderEmail(order, true, "admin@example.com", context);
  assert.match(email.html, /paid \/ paid/);
  assert.match(email.html, /href="https:\/\/sekanae.example\/admin\/orders"/);
  assert.equal(email.template, 'admin_order_paid');
});
