import { baseCurrency, type CurrencyCode } from "../../../packages/catalog/src/index.js";
import { getStoreSettings } from "./settings-service.js";

export type { CurrencyCode };

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

export function convertFromBaseCurrency(amount: number, currency: CurrencyCode, exchangeRates: Record<string, number>) {
  if (currency === baseCurrency) {
    return roundMoney(amount);
  }

  return roundMoney(amount * (exchangeRates[currency] ?? 1));
}

function includedTaxAmount(grossAmount: number, taxRate: number) {
  if (taxRate <= 0) return 0;
  return roundMoney(grossAmount - grossAmount / (1 + taxRate));
}

export async function calculateOrderPricing(subtotal: number, currency?: CurrencyCode): Promise<OrderPricing> {
  const settings = await getStoreSettings();
  const selectedCurrency = currency ?? settings.defaultCurrency as CurrencyCode;
  const shipping = convertFromBaseCurrency(settings.defaultShippingAmount, selectedCurrency, settings.exchangeRates);
  const taxableAmount = subtotal + shipping;

  if (settings.vatIncluded) {
    return {
      currency: selectedCurrency,
      subtotal: roundMoney(subtotal),
      shipping,
      tax: includedTaxAmount(taxableAmount, settings.vatRate),
      total: roundMoney(taxableAmount),
      taxRate: settings.vatRate,
      taxIncluded: true,
    };
  }

  const tax = roundMoney(taxableAmount * settings.vatRate);

  return {
    currency: selectedCurrency,
    subtotal: roundMoney(subtotal),
    shipping,
    tax,
    total: roundMoney(taxableAmount + tax),
    taxRate: settings.vatRate,
    taxIncluded: false,
  };
}
