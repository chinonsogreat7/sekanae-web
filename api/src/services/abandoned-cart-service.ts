import { config } from "../config.js";
import {
  getOrCreateCartReminderSuppressionToken,
  listSavedCartProductSummaries,
  listSavedCartsReadyForReminder,
  recordCartReminderSent,
  type SavedCart,
  type SavedCartProductSummary,
} from "../repositories/customer-cart-repository.js";
import { sendEmail } from "./email-service.js";
import { buildCartReminderEmail } from "../emails/templates.js";
import { convertFromBaseCurrency } from "./pricing-service.js";
import { getStoreSettings } from "./settings-service.js";

type ReminderResult = {
  checked: number;
  sent: number;
  failed: number;
  skipped: number;
};

function buildReminderEmail(
  cart: SavedCart,
  products: Map<string, SavedCartProductSummary>,
  unsubscribeToken: string,
  exchangeRates: Record<string, number>,
) {
  return buildCartReminderEmail({
    email: cart.email,
    final: cart.reminderCount > 0,
    currency: cart.currency,
    webOrigin: config.WEB_ORIGIN,
    unsubscribeUrl: `${config.API_PUBLIC_URL}/api/cart/reminders/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`,
    items: cart.items.flatMap(item => {
      const product = products.get(item.productId);
      return product ? [{ ...item, name: product.name, image: product.image, href: `${config.WEB_ORIGIN}/product/${encodeURIComponent(product.slug)}`, lineTotal: convertFromBaseCurrency(product.price, cart.currency, exchangeRates) * item.quantity }] : [];
    }),
  });
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
