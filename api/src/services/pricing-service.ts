import { config } from "../config.js";

export type CurrencyCode = "USD" | "GBP" | "EUR" | "NGN" | "AED";

export type OrderPricing = {
  currency: CurrencyCode;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  taxRate: number;
  taxIncluded: boolean;
};

function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function includedTaxAmount(grossAmount: number, taxRate: number) {
  if (taxRate <= 0) return 0;
  return roundMoney(grossAmount - grossAmount / (1 + taxRate));
}

export function calculateOrderPricing(subtotal: number): OrderPricing {
  const shipping = roundMoney(config.DEFAULT_SHIPPING_AMOUNT);
  const taxableAmount = subtotal + shipping;

  if (config.VAT_INCLUDED) {
    return {
      currency: config.DEFAULT_CURRENCY,
      subtotal: roundMoney(subtotal),
      shipping,
      tax: includedTaxAmount(taxableAmount, config.VAT_RATE),
      total: roundMoney(taxableAmount),
      taxRate: config.VAT_RATE,
      taxIncluded: true,
    };
  }

  const tax = roundMoney(taxableAmount * config.VAT_RATE);

  return {
    currency: config.DEFAULT_CURRENCY,
    subtotal: roundMoney(subtotal),
    shipping,
    tax,
    total: roundMoney(taxableAmount + tax),
    taxRate: config.VAT_RATE,
    taxIncluded: false,
  };
}
