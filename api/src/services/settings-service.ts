import { currencies } from "../../../packages/catalog/src/index.js";
import { config } from "../config.js";
import { hasDatabase } from "../db/pool.js";
import { getStoreSettingsFromDatabase, type StoreSettings } from "../repositories/settings-repository.js";

export function defaultExchangeRates() {
  return Object.fromEntries(Object.entries(currencies).map(([code, meta]) => [code, meta.rate]));
}

export function defaultStoreSettings(): StoreSettings {
  return {
    defaultCurrency: config.DEFAULT_CURRENCY,
    defaultMarketCountry: config.DEFAULT_MARKET_COUNTRY,
    defaultShippingAmount: config.DEFAULT_SHIPPING_AMOUNT,
    vatRate: config.VAT_RATE,
    vatIncluded: config.VAT_INCLUDED,
    exchangeRates: defaultExchangeRates(),
    storeContactEmail: config.ADMIN_EMAIL,
    apiPublicUrl: config.API_PUBLIC_URL,
    webOrigin: config.WEB_ORIGIN,
  };
}

export async function getStoreSettings() {
  const defaults = defaultStoreSettings();

  if (!hasDatabase()) {
    return defaults;
  }

  return getStoreSettingsFromDatabase(defaults);
}
