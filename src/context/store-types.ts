import type { Product, CurrencyCode } from "../data/catalog";
import type { ExchangeRates } from "../utils/money";

export type CartItem = {
  productId: string;
  color: string;
  quantity: number;
  giftWrap: boolean;
};

export type CustomerAccount = {
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
};

export type AccountPromptMode = "create" | "sign-in" | "verify";

export type StoreContextValue = {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  exchangeRates: ExchangeRates;
  defaultShippingAmount: number;
  cartItems: CartItem[];
  promoCode: string;
  setPromoCode: (code: string) => void;
  wishlist: string[];
  customerAccount: CustomerAccount | null;
  cartProducts: Array<CartItem & { product: Product }>;
  cartCount: number;
  subtotal: number;
  addToCart: (productId: string, color?: string) => void;
  removeFromCart: (productId: string, color?: string) => void;
  updateQuantity: (productId: string, quantity: number, color?: string) => void;
  toggleGiftWrap: (productId: string, color?: string) => void;
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  openAccountPrompt: (reason?: string, mode?: AccountPromptMode) => void;
  openCustomerProfile: () => void;
  createCustomerAccount: (account: Omit<CustomerAccount, "createdAt">) => Promise<void>;
  signInCustomer: (email: string) => Promise<void>;
  verifyCustomerSignIn: (code: string) => Promise<void>;
  signOutCustomer: () => void;
  clearCart: () => void;
};

export type AccountNotice = {
  message: string;
  detail?: string;
  tone?: "success" | "error";
};

export type MarketSettingsResponse = {
  data: {
    defaultCurrency: CurrencyCode;
    defaultShippingAmount: number;
    exchangeRates: ExchangeRates;
  };
};
