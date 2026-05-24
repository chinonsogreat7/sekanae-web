import { getProductById } from "./catalog-service.js";
import { getStoreSettings } from "./settings-service.js";
import { convertFromBaseCurrency, type CurrencyCode } from "./pricing-service.js";

export type CartValidationInput = {
  currency?: CurrencyCode;
  items: Array<{
    productId: string;
    quantity: number;
    color?: string;
  }>;
};

export type ValidatedCartItem = {
  productId: string;
  slug: string;
  name: string;
  color: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  availableQuantity: number;
  isAvailable: boolean;
  message?: string;
};

export type ValidatedCart = {
  currency: CurrencyCode;
  subtotal: number;
  items: ValidatedCartItem[];
  canCheckout: boolean;
};

export async function validateCart(input: CartValidationInput): Promise<ValidatedCart> {
  const settings = await getStoreSettings();
  const currency = input.currency ?? settings.defaultCurrency as CurrencyCode;
  const items = await Promise.all(input.items.map(async (item) => {
    const product = await getProductById(item.productId);

    if (!product) {
      return {
        productId: item.productId,
        slug: "",
        name: "Unknown product",
        color: item.color ?? "Default",
        quantity: item.quantity,
        unitPrice: 0,
        lineTotal: 0,
        availableQuantity: 0,
        isAvailable: false,
        message: "This product is no longer available.",
      };
    }

    const color = item.color && product.colors.includes(item.color) ? item.color : product.colors[0] ?? "Default";
    const isAvailable = product.stock >= item.quantity;
    const unitPrice = convertFromBaseCurrency(product.price, currency, settings.exchangeRates);

    return {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      color,
      quantity: item.quantity,
      unitPrice,
      lineTotal: isAvailable ? unitPrice * item.quantity : 0,
      availableQuantity: product.stock,
      isAvailable,
      message: isAvailable ? undefined : `Only ${product.stock} available.`,
    };
  }));

  return {
    currency,
    subtotal: items.reduce((total, item) => total + item.lineTotal, 0),
    items,
    canCheckout: items.length > 0 && items.every((item) => item.isAvailable),
  };
}
