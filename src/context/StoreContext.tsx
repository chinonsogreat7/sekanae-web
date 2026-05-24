import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getApiBaseUrl } from "../api/config";
import { products, type CurrencyCode, type Product } from "../data/catalog";
import { defaultExchangeRates, type ExchangeRates } from "../utils/money";

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

type StoreContextValue = {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  exchangeRates: ExchangeRates;
  defaultShippingAmount: number;
  cartItems: CartItem[];
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
  openAccountPrompt: (reason?: string) => void;
  createCustomerAccount: (account: Omit<CustomerAccount, "createdAt">) => void;
  signOutCustomer: () => void;
  clearCart: () => void;
};

type MarketSettingsResponse = {
  data: {
    defaultCurrency: CurrencyCode;
    defaultShippingAmount: number;
    exchangeRates: ExchangeRates;
  };
};

const StoreContext = createContext<StoreContextValue | undefined>(undefined);
const cartStorageKey = "sekanae_cart";
const wishlistStorageKey = "sekanae_wishlist";
const customerStorageKey = "sekanae_customer_account";

function readStorage<TValue>(key: string, fallback: TValue): TValue {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) as TValue : fallback;
  } catch {
    return fallback;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(defaultExchangeRates);
  const [defaultShippingAmount, setDefaultShippingAmount] = useState(35);
  const [cartItems, setCartItems] = useState<CartItem[]>(() => readStorage<CartItem[]>(cartStorageKey, []));
  const [wishlist, setWishlist] = useState<string[]>(() => readStorage<string[]>(wishlistStorageKey, []));
  const [customerAccount, setCustomerAccount] = useState<CustomerAccount | null>(() =>
    readStorage<CustomerAccount | null>(customerStorageKey, null)
  );
  const [accountPromptReason, setAccountPromptReason] = useState<string | null>(null);
  const [pendingWishlistProductId, setPendingWishlistProductId] = useState<string | null>(null);
  const [accountDraft, setAccountDraft] = useState({
    email: "",
    firstName: "",
    lastName: "",
  });

  useEffect(() => {
    let isCurrent = true;

    fetch(`${getApiBaseUrl()}/api/market-settings`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Market settings unavailable.");
        }

        return response.json() as Promise<MarketSettingsResponse>;
      })
      .then((payload) => {
        if (!isCurrent) return;
        setCurrency(payload.data.defaultCurrency);
        setDefaultShippingAmount(payload.data.defaultShippingAmount);
        setExchangeRates({
          ...defaultExchangeRates,
          ...payload.data.exchangeRates,
        });
      })
      .catch(() => {
        if (!isCurrent) return;
        setExchangeRates(defaultExchangeRates);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(cartStorageKey, JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    window.localStorage.setItem(wishlistStorageKey, JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    if (customerAccount) {
      window.localStorage.setItem(customerStorageKey, JSON.stringify(customerAccount));
      return;
    }

    window.localStorage.removeItem(customerStorageKey);
  }, [customerAccount]);

  const cartProducts = useMemo(
    () =>
      cartItems
        .map((item) => {
          const product = products.find((candidate) => candidate.id === item.productId);
          return product ? { ...item, product } : null;
        })
        .filter((item): item is CartItem & { product: Product } => Boolean(item)),
    [cartItems]
  );

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const subtotal = cartProducts.reduce(
    (total, item) => total + item.product.price * item.quantity + (item.giftWrap ? 18 : 0),
    0
  );

  function getDefaultColor(productId: string, color?: string) {
    return color ?? products.find((product) => product.id === productId)?.colors[0] ?? "Default";
  }

  function addToCart(productId: string, color?: string) {
    const selectedColor = getDefaultColor(productId, color);
    setCartItems((items) => {
      const existing = items.find((item) => item.productId === productId && item.color === selectedColor);
      if (existing) {
        return items.map((item) =>
          item.productId === productId && item.color === selectedColor
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...items, { productId, color: selectedColor, quantity: 1, giftWrap: false }];
    });
  }

  function removeFromCart(productId: string, color?: string) {
    setCartItems((items) =>
      items.filter((item) => !(item.productId === productId && (!color || item.color === color)))
    );
  }

  function updateQuantity(productId: string, quantity: number, color?: string) {
    if (quantity < 1) {
      removeFromCart(productId, color);
      return;
    }
    setCartItems((items) =>
      items.map((item) =>
        item.productId === productId && (!color || item.color === color) ? { ...item, quantity } : item
      )
    );
  }

  function toggleGiftWrap(productId: string, color?: string) {
    setCartItems((items) =>
      items.map((item) =>
        item.productId === productId && (!color || item.color === color)
          ? { ...item, giftWrap: !item.giftWrap }
          : item
      )
    );
  }

  function toggleWishlist(productId: string) {
    if (!customerAccount) {
      setPendingWishlistProductId(productId);
      openAccountPrompt("Create an account to save pieces to your wishlist.");
      return;
    }

    setWishlist((items) =>
      items.includes(productId)
        ? items.filter((item) => item !== productId)
        : [...items, productId]
    );
  }

  function isWishlisted(productId: string) {
    return wishlist.includes(productId);
  }

  function clearCart() {
    setCartItems([]);
  }

  function openAccountPrompt(reason = "Create an account to continue.") {
    setAccountPromptReason(reason);
  }

  function createCustomerAccount(account: Omit<CustomerAccount, "createdAt">) {
    setCustomerAccount({
      email: account.email.trim().toLowerCase(),
      firstName: account.firstName.trim(),
      lastName: account.lastName.trim(),
      createdAt: new Date().toISOString(),
    });
    if (pendingWishlistProductId) {
      setWishlist((items) => items.includes(pendingWishlistProductId) ? items : [...items, pendingWishlistProductId]);
      setPendingWishlistProductId(null);
    }
    setAccountPromptReason(null);
    setAccountDraft({ email: "", firstName: "", lastName: "" });
  }

  function signOutCustomer() {
    setCustomerAccount(null);
    setWishlist([]);
  }

  const value: StoreContextValue = {
    currency,
    setCurrency,
    exchangeRates,
    defaultShippingAmount,
    cartItems,
    wishlist,
    customerAccount,
    cartProducts,
    cartCount,
    subtotal,
    addToCart,
    removeFromCart,
    updateQuantity,
    toggleGiftWrap,
    toggleWishlist,
    isWishlisted,
    openAccountPrompt,
    createCustomerAccount,
    signOutCustomer,
    clearCart,
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
      {accountPromptReason && (
        <div className="modal-backdrop account-gate-backdrop" role="dialog" aria-modal="true" aria-label="Create your SEKANAE account">
          <section className="account-gate-panel">
            <button className="icon-button modal-close" type="button" aria-label="Close account prompt" onClick={() => setAccountPromptReason(null)}>
              ×
            </button>
            <p className="microcopy">SEKANAE account</p>
            <h2>Create your account</h2>
            <p>{accountPromptReason}</p>
            <form onSubmit={(event) => {
              event.preventDefault();
              createCustomerAccount(accountDraft);
            }}>
              <label>
                Email
                <input
                  type="email"
                  value={accountDraft.email}
                  onChange={(event) => setAccountDraft((current) => ({ ...current, email: event.target.value }))}
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                First name
                <input
                  value={accountDraft.firstName}
                  onChange={(event) => setAccountDraft((current) => ({ ...current, firstName: event.target.value }))}
                  autoComplete="given-name"
                  required
                />
              </label>
              <label>
                Last name
                <input
                  value={accountDraft.lastName}
                  onChange={(event) => setAccountDraft((current) => ({ ...current, lastName: event.target.value }))}
                  autoComplete="family-name"
                  required
                />
              </label>
              <button className="primary-button" type="submit">Create account</button>
            </form>
          </section>
        </div>
      )}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used inside StoreProvider");
  }
  return context;
}
