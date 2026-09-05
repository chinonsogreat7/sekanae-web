import { currencies, type CurrencyCode } from "../data/catalog";

export type ExchangeRates = Record<CurrencyCode, number>;

export const defaultExchangeRates = Object.fromEntries(
  Object.entries(currencies).map(([code, meta]) => [code, meta.rate]),
) as ExchangeRates;

export function formatMoney(amount: number, currency: CurrencyCode, exchangeRates: Partial<ExchangeRates> = defaultExchangeRates) {
  const selected = currencies[currency];
  const converted = amount * (exchangeRates[currency] ?? selected.rate);
  return formatCurrencyAmount(converted, currency);
}

export function formatCurrencyAmount(amount: number, currency: CurrencyCode) {
  const selected = currencies[currency];
  const maximumFractionDigits = 2;

  return `${selected.symbol}${amount.toLocaleString(undefined, {
    maximumFractionDigits,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  })}`;
}
