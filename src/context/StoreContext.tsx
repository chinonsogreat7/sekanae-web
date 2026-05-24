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

type StoreContextValue = {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  exchangeRates: ExchangeRates;
  defaultShippingAmount: number;
  cartItems: CartItem[];
  wishlist: string[];
  cartProducts: Array<CartItem & { product: Product }>;
  cartCount: number;
  subtotal: number;
  addToCart: (productId: string, color?: string) => void;
  removeFromCart: (productId: string, color?: string) => void;
  updateQuantity: (productId: string, quantity: number, color?: string) => void;
  toggleGiftWrap: (productId: string, color?: string) => void;
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(defaultExchangeRates);
  const [defaultShippingAmount, setDefaultShippingAmount] = useState(35);
  const [cartItems, setCartItems] = useState<CartItem[]>([
    { productId: "p-002", color: "Gold", quantity: 1, giftWrap: false },
    { productId: "p-005", color: "Espresso", quantity: 1, giftWrap: true },
  ]);
  const [wishlist, setWishlist] = useState<string[]>(["p-006", "p-008"]);

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

  const value: StoreContextValue = {
    currency,
    setCurrency,
    exchangeRates,
    defaultShippingAmount,
    cartItems,
    wishlist,
    cartProducts,
    cartCount,
    subtotal,
    addToCart,
    removeFromCart,
    updateQuantity,
    toggleGiftWrap,
    toggleWishlist,
    isWishlisted,
    clearCart,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used inside StoreProvider");
  }
  return context;
}
