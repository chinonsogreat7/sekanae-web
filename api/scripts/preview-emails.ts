// Render only: this script never calls sendEmail, a database, or an email provider.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { products } from "../../packages/catalog/src/index.js";
import { buildAdminOrderEmail, buildCartReminderEmail, buildCustomerOrderEmail, buildLoginCodeEmail, buildNewsletterEmail } from "../src/emails/templates.js";
import { emailButton, escapeHtml, paragraph, renderEditorialEmail, section } from "../src/emails/editorial.js";
import type { Order } from "../src/services/order-service.js";

const chosen = [products.find(p => p.id === "p-001")!, products.find(p => p.id === "p-002")!];
const webOrigin = "https://sekanae.co";
const context = { webOrigin, images: new Map(chosen.map(p => [p.id, p.images[0]])) };
const order: Order = {
  id: "73e0ca73-55e2-4f4d-8c06-000000001042", customer: { name: "Amara Okafor", email: "amara@example.com" },
  currency: "EUR", subtotal: 860, discount: 86, promoCode: "WELCOME10", shipping: 35, tax: 123.41, taxRate: 0.18, taxIncluded: true, total: 809,
  status: "paid", paymentStatus: "paid", shippingAddress: { line1: "12 Palm Avenue", city: "Lagos", country: "Nigeria" },
  items: chosen.map(p => ({ id: `item-${p.id}`, productId: p.id, slug: p.slug, name: p.name, color: p.colors[0], quantity: 1, unitPrice: p.price, lineTotal: p.price })),
  createdAt: "2026-09-05T12:00:00.000Z", updatedAt: "2026-09-05T12:00:00.000Z",
};
const newsletter = { email: "amara@example.com", webOrigin, unsubscribeUrl: "https://example.com/newsletter/unsubscribe?token=sample" };
const reminder = { email: order.customer.email, webOrigin, currency: order.currency, unsubscribeUrl: "https://example.com/cart/unsubscribe?token=sample", items: order.items.map(item => ({ ...item, href: `${webOrigin}/product/${encodeURIComponent(item.slug)}`, image: context.images.get(item.productId) })) };
const samples = [
  { id: "order-confirmed", name: "Order confirmed", group: "Orders", description: "The selected Editorial direction, with catalog photography, saved totals, and delivery details.", ...buildCustomerOrderEmail(order, true, context) },
  { id: "order-pending", name: "Payment pending", group: "Orders", description: "Clear payment status, the selected pieces, and support for completing the order.", ...buildCustomerOrderEmail({ ...order, status: "pending", paymentStatus: "unpaid" }, false, context) },
  { id: "sign-in", name: "Sign-in code", group: "Account", description: "A prominent code and expiry, with the same Editorial identity.", ...buildLoginCodeEmail({ email: order.customer.email, code: "482619", purpose: "sign-in", ttlSeconds: 600, webOrigin }) },
  { id: "verify-account", name: "Verify account", group: "Account", description: "A welcoming first step, with account verification kept simple.", ...buildLoginCodeEmail({ email: order.customer.email, code: "482619", purpose: "create", ttlSeconds: 600, webOrigin }) },
  { id: "newsletter-welcome", name: "Newsletter welcome", group: "Studio notes", description: "A warm introduction, a collection link, and a clear unsubscribe option.", html: buildNewsletterEmail({ ...newsletter, welcome: true, subject: "Welcome to SEKANAE", previewText: "Considered arrivals, thoughtful edits, and notes from the studio.", html: paragraph("Hello Amara,") + paragraph("You are now subscribed to SEKANAE updates. We will send considered arrivals, edits, and client notes to this inbox.") + emailButton("Explore the collection", `${webOrigin}/shop`) }) },
  { id: "newsletter-campaign", name: "Newsletter campaign", group: "Studio notes", description: "The Editorial frame around content from the newsletter editor.", html: buildNewsletterEmail({ ...newsletter, subject: "A considered edit.", previewText: "Pieces for the days ahead.", html: `<img src="${escapeHtml(chosen[1].images[0])}" width="520" alt="${escapeHtml(chosen[1].name)}" style="display:block;width:100%;height:auto;"/><h2 style="font-size:28px;font-weight:normal;line-height:1.2;">The finishing touch.</h2>` + paragraph(chosen[1].description) + emailButton("Discover the edit", `${webOrigin}/shop`) }) },
  { id: "cart-first", name: "Saved cart reminder", group: "Saved carts", description: "A gentle return to selected products, without promising stock or final checkout totals.", ...buildCartReminderEmail({ ...reminder, final: false }) },
  { id: "cart-final", name: "Final cart reminder", group: "Saved carts", description: "A restrained final follow-up with a visible opt-out link.", ...buildCartReminderEmail({ ...reminder, final: true }) },
  { id: "admin-new-order", name: "Admin · new order", group: "Operations", description: "Customer, status, and financial details for the studio.", ...buildAdminOrderEmail({ ...order, status: "pending", paymentStatus: "unpaid" }, false, "studio@example.com", context) },
  { id: "admin-paid-order", name: "Admin · paid order", group: "Operations", description: "Payment confirmation and a direct route to order management.", ...buildAdminOrderEmail(order, true, "studio@example.com", context) },
  { id: "concierge", name: "Concierge request", group: "Operations", description: "The shared Editorial shell used for client-care notifications.", html: renderEditorialEmail({ title: "Concierge request", webOrigin, rows: section("<p><strong>Name:</strong> Amara Okafor</p><p><strong>Email:</strong> amara@example.com</p><p><strong>Topic:</strong> Gift packaging</p><p><strong>Message:</strong></p><p>I’m choosing a gift. Could you share the available packaging options?</p>") }) },
];
const output = new URL("../../docs/email-preview/", import.meta.url);
await mkdir(output, { recursive: true });
for (const sample of samples) {
  await writeFile(new URL(`${sample.id}.html`, output), sample.html);
  if ('text' in sample) await writeFile(new URL(`${sample.id}.txt`, output), sample.text);
}
const shell = await readFile(new URL("../../scripts/email-preview-shell.html", import.meta.url), "utf8");
const metadata = samples.map(({ id, name, group, description }) => ({ id, name, group, description }));
await writeFile(new URL("../../email-template-previews.html", import.meta.url), shell.replace('__EMAILS__', JSON.stringify(metadata).replaceAll('<', '\\u003c')));
console.log(`Rendered ${samples.length} Editorial previews. Open /email-template-previews.html.`);
