import { hasDatabase } from "../db/pool.js";
import { findPromoCode, type PromoCode } from "../repositories/promo-repository.js";

export class PromoCodeError extends Error {
  readonly statusCode = 400;
}

export function evaluatePromo(promo: PromoCode | undefined, subtotal: number, minimumSubtotal: number, now = Date.now()) {
  if (!promo || !promo.active) throw new PromoCodeError("This promo code is invalid or inactive.");
  if (promo.expiresAt && Date.parse(promo.expiresAt) <= now) throw new PromoCodeError("This promo code has expired.");
  if (Math.round(subtotal * 100) < Math.round(minimumSubtotal * 100)) {
    throw new PromoCodeError("Your cart does not meet this promo code’s minimum spend.");
  }
  if (subtotal <= 0) throw new PromoCodeError("Add an available item before applying a promo code.");
  return { promoCode: promo.code, discount: Math.min(subtotal, Math.round(Math.round(subtotal * 100) * promo.percentage / 100) / 100) };
}

export async function getPromoCode(code: string) {
  if (!hasDatabase()) throw new PromoCodeError("Promo codes are temporarily unavailable. Please try again later or remove the code.");
  return findPromoCode(code.trim().toUpperCase());
}
