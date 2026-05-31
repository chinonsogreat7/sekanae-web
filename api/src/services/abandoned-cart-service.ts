import { config } from "../config.js";
import {
  getOrCreateCartReminderSuppressionToken,
  listSavedCartProductSummaries,
  listSavedCartsReadyForReminder,
  recordCartReminderSent,
  type SavedCart,
  type SavedCartProductSummary,
} from "../repositories/customer-cart-repository.js";
import { baseEmailHtml, escapeHtml, sendEmail } from "./email-service.js";
import { convertFromBaseCurrency, type CurrencyCode } from "./pricing-service.js";
import { getStoreSettings } from "./settings-service.js";

type ReminderResult = {
  checked: number;
  sent: number;
  failed: number;
  skipped: number;
};

function money(amount: number, currency: CurrencyCode) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function productUrl(slug: string) {
  return `${config.WEB_ORIGIN}/product/${encodeURIComponent(slug)}`;
}

function cartUrl() {
  return `${config.WEB_ORIGIN}/cart`;
}

function unsubscribeUrl(token: string) {
  return `${config.API_PUBLIC_URL}/api/cart/reminders/unsubscribe?token=${encodeURIComponent(token)}`;
}

function reminderIntro(cart: SavedCart) {
  if (cart.reminderCount === 0) {
    return {
      subject: "Your SEKANAE edit is waiting",
      title: "Still thinking it over?",
      lead: "The pieces you selected are still resting in your cart. We saved them so you can return when the moment feels right.",
    };
  }

  return {
    subject: "A final note about your SEKANAE cart",
    title: "One last studio note",
    lead: "A gentle reminder before your saved cart falls away from our studio follow-up list.",
  };
}

function itemRows(
  cart: SavedCart,
  products: Map<string, SavedCartProductSummary>,
  exchangeRates: Record<string, number>,
) {
  return cart.items
    .map((item) => {
      const product = products.get(item.productId);

      if (!product) {
        return "";
      }

      const convertedPrice = convertFromBaseCurrency(product.price, cart.currency, exchangeRates);
      const image = product.image
        ? `<img src="${escapeHtml(product.image)}" alt="" width="92" height="116" style="display:block;width:92px;height:116px;object-fit:cover;border:1px solid #eadbd5;" />`
        : `<div style="width:92px;height:116px;background:#fbf1ee;border:1px solid #eadbd5;"></div>`;

      return `
        <tr>
          <td style="padding:18px 0;border-bottom:1px solid #eadbd5;width:108px;vertical-align:top;">${image}</td>
          <td style="padding:18px 0;border-bottom:1px solid #eadbd5;vertical-align:top;">
            <a href="${escapeHtml(productUrl(product.slug))}" style="font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:1.25;color:#2f2420;text-decoration:none;">${escapeHtml(product.name)}</a>
            <div style="margin-top:8px;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#a66f67;">${escapeHtml(item.color)} / Qty ${item.quantity}</div>
            ${item.giftWrap ? `<div style="margin-top:8px;color:#7f6b63;">Gift packaging selected</div>` : ""}
          </td>
          <td align="right" style="padding:18px 0;border-bottom:1px solid #eadbd5;vertical-align:top;color:#2f2420;font-weight:700;">
            ${money(convertedPrice * item.quantity, cart.currency)}
          </td>
        </tr>
      `;
    })
    .join("");
}

function buildReminderEmail(
  cart: SavedCart,
  products: Map<string, SavedCartProductSummary>,
  unsubscribeToken: string,
  exchangeRates: Record<string, number>,
) {
  const intro = reminderIntro(cart);
  const rows = itemRows(cart, products, exchangeRates);
  const body = `
    <p style="margin:0 0 18px;font-size:16px;line-height:1.8;">${escapeHtml(intro.lead)}</p>
    <table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:22px 0;">
      ${rows}
    </table>
    <div style="text-align:center;margin:30px 0 22px;">
      <a href="${escapeHtml(cartUrl())}" style="display:inline-block;background:#2f2420;color:#fff;text-decoration:none;padding:16px 24px;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Return to your cart</a>
    </div>
    <div style="background:#fff7f3;border:1px solid #eadbd5;padding:16px 18px;color:#6b5851;">
      Our studio only sends two cart reminders. You can ignore this email, continue shopping, or unsubscribe from cart reminders below.
    </div>
    <p style="margin:22px 0 0;font-size:12px;line-height:1.7;color:#7f6b63;">
      <a href="${escapeHtml(unsubscribeUrl(unsubscribeToken))}" style="color:#7f6b63;">Stop cart reminders</a>
    </p>
  `;

  return {
    to: cart.email,
    subject: intro.subject,
    html: baseEmailHtml(intro.title, body),
    text: `${intro.lead}\n\nReturn to your cart: ${cartUrl()}\nStop cart reminders: ${unsubscribeUrl(unsubscribeToken)}`,
    template: cart.reminderCount === 0 ? "abandoned_cart_first" : "abandoned_cart_final",
  };
}

export async function sendAbandonedCartReminders(input: { limit?: number } = {}): Promise<ReminderResult> {
  const carts = await listSavedCartsReadyForReminder(input.limit ?? 50);
  const settings = await getStoreSettings();
  const result: ReminderResult = {
    checked: carts.length,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  for (const cart of carts) {
    const products = await listSavedCartProductSummaries(cart.items.map((item) => item.productId));
    const sendableItems = cart.items.filter((item) => products.has(item.productId));

    if (sendableItems.length === 0) {
      result.skipped += 1;
      continue;
    }

    const unsubscribeToken = await getOrCreateCartReminderSuppressionToken(cart.email);
    const email = buildReminderEmail(
      { ...cart, items: sendableItems },
      products,
      unsubscribeToken,
      settings.exchangeRates,
    );
    const sendResult = await sendEmail(email);

    if (sendResult.status === "sent") {
      await recordCartReminderSent(cart.email);
      result.sent += 1;
    } else if (sendResult.status === "skipped") {
      result.skipped += 1;
    } else {
      result.failed += 1;
    }
  }

  return result;
}
