import { currencies, type CurrencyCode } from "../data/catalog";

export function formatMoney(amount: number, currency: CurrencyCode) {
  const selected = currencies[currency];
  const converted = amount * selected.rate;
  const maximumFractionDigits = currency === "NGN" ? 0 : 2;

  return `${selected.symbol}${converted.toLocaleString(undefined, {
    maximumFractionDigits,
    minimumFractionDigits: currency === "NGN" ? 0 : 0,
  })}`;
}
