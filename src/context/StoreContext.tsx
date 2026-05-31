import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  requestCustomerCode,
  signOutCustomerSession,
  validateCustomerSession,
  verifyCustomerCode,
} from "../api/customerAuth";
import { getCustomerWishlist, replaceCustomerWishlist } from "../api/customerWishlist";
import { getApiBaseUrl } from "../api/config";
import { products, type CurrencyCode, type Product } from "../data/catalog";
import { defaultExchangeRates, type ExchangeRates } from "../utils/money";
import { StoreContext } from "./store-context";
import type { AccountNotice, AccountPromptMode, CartItem, CustomerAccount, MarketSettingsResponse, StoreContextValue } from "./store-types";
const cartStorageKey = "sekanae_cart";
const wishlistStorageKey = "sekanae_wishlist";
const customerStorageKey = "sekanae_customer_account";
const customerTokenStorageKey = "sekanae_customer_token";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const codePattern = /^\d{6}$/;

function sameStringList(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

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
  const [currency, setCurrency] = useState<CurrencyCode>("EUR");
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(defaultExchangeRates);
  const [defaultShippingAmount, setDefaultShippingAmount] = useState(35);
  const [cartItems, setCartItems] = useState<CartItem[]>(() => readStorage<CartItem[]>(cartStorageKey, []));
  const [wishlist, setWishlist] = useState<string[]>(() => readStorage<string[]>(wishlistStorageKey, []));
  const [customerAccount, setCustomerAccount] = useState<CustomerAccount | null>(() =>
    readStorage<CustomerAccount | null>(customerStorageKey, null)
  );
  const [customerToken, setCustomerToken] = useState<string | null>(() => readStorage<string | null>(customerTokenStorageKey, null));
  const [accountPromptReason, setAccountPromptReason] = useState<string | null>(null);
  const [accountPromptMode, setAccountPromptMode] = useState<AccountPromptMode>("create");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [pendingWishlistProductId, setPendingWishlistProductId] = useState<string | null>(null);
  const [accountDraft, setAccountDraft] = useState({
    email: "",
    firstName: "",
    lastName: "",
  });
  const [signInDraft, setSignInDraft] = useState({ email: "" });
  const [codeDraft, setCodeDraft] = useState({ code: "" });
  const [pendingAuth, setPendingAuth] = useState<{
    email: string;
    purpose: "create" | "sign-in";
    firstName?: string;
    lastName?: string;
  } | null>(null);
  const [accountFormError, setAccountFormError] = useState<string | null>(null);
  const [accountFormHelp, setAccountFormHelp] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [accountNotice, setAccountNotice] = useState<AccountNotice | null>(null);
  const customerEmail = customerAccount?.email;

  function showAccountError(message: string) {
    setAccountFormError(message);
    setAccountNotice({
      message,
      tone: "error",
    });
  }

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

  useEffect(() => {
    if (customerToken) {
      window.localStorage.setItem(customerTokenStorageKey, JSON.stringify(customerToken));
      return;
    }

    window.localStorage.removeItem(customerTokenStorageKey);
  }, [customerToken]);

  useEffect(() => {
    if (!customerToken) {
      return undefined;
    }

    let isCurrent = true;

    validateCustomerSession(customerToken)
      .then((session) => {
        if (!isCurrent) return;
        setCustomerAccount(session.customer);
      })
      .catch(() => {
        if (!isCurrent) return;
        setCustomerToken(null);
        setCustomerAccount(null);
      });

    return () => {
      isCurrent = false;
    };
  }, [customerToken]);

  useEffect(() => {
    if (!customerToken || !customerEmail) {
      return undefined;
    }

    let isCurrent = true;

    getCustomerWishlist(customerToken)
      .then((payload) => {
        if (!isCurrent) return;

        setWishlist((items) => {
          const mergedWishlist = [...new Set([...payload.productIds, ...items])];

          if (!sameStringList(mergedWishlist, payload.productIds)) {
            void replaceCustomerWishlist(customerToken, mergedWishlist).catch(() => undefined);
          }

          return mergedWishlist;
        });
      })
      .catch(() => {
        if (!isCurrent) return;
        setAccountNotice({
          message: "Wishlist sync paused.",
          detail: "Your saved pieces are still available on this browser.",
          tone: "error",
        });
      });

    return () => {
      isCurrent = false;
    };
  }, [customerEmail, customerToken]);

  useEffect(() => {
    if (!accountNotice) {
      return undefined;
    }

    if (accountNotice.tone === "error") {
      return undefined;
    }

    const timeout = window.setTimeout(() => setAccountNotice(null), 5200);
    return () => window.clearTimeout(timeout);
  }, [accountNotice]);

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
  const subtotal = cartProducts.reduce((total, item) => total + item.product.price * item.quantity, 0);
  const wishlistProducts = useMemo(
    () =>
      wishlist
        .map((productId) => products.find((product) => product.id === productId))
        .filter((product): product is Product => Boolean(product)),
    [wishlist],
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

  function persistCustomerWishlist(productIds: string[], token = customerToken, showError = true) {
    if (!token) {
      return;
    }

    void replaceCustomerWishlist(token, productIds).catch(() => {
      if (!showError) {
        return;
      }

      setAccountNotice({
        message: "Wishlist sync failed.",
        detail: "We kept your saved pieces on this browser and will try again later.",
        tone: "error",
      });
    });
  }

  function toggleWishlist(productId: string) {
    if (!customerAccount) {
      setPendingWishlistProductId(productId);
      openAccountPrompt("Create an account to save pieces to your wishlist.");
      return;
    }

    setWishlist((items) => {
      const nextWishlist = items.includes(productId)
        ? items.filter((item) => item !== productId)
        : [...items, productId];

      persistCustomerWishlist(nextWishlist);
      return nextWishlist;
    });
  }

  function isWishlisted(productId: string) {
    return wishlist.includes(productId);
  }

  function clearCart() {
    setCartItems([]);
  }

  function openAccountPrompt(reason = "Create an account to continue.", mode: AccountPromptMode = "create") {
    setAccountFormError(null);
    setAccountFormHelp(null);
    setAccountPromptMode(mode);
    setAccountPromptReason(reason);
    setSignInDraft({ email: customerAccount?.email ?? accountDraft.email });
    setCodeDraft({ code: "" });
  }

  function openCustomerProfile() {
    setIsProfileOpen(true);
  }

  function validateCustomerAccount(account: Omit<CustomerAccount, "createdAt">) {
    const email = account.email.trim().toLowerCase();
    const firstName = account.firstName.trim();
    const lastName = account.lastName.trim();

    if (!emailPattern.test(email)) {
      return "Enter a valid email address.";
    }

    if (firstName.length < 2) {
      return "Enter the customer's first name.";
    }

    if (lastName.length < 2) {
      return "Enter the customer's last name.";
    }

    return null;
  }

  async function createCustomerAccount(account: Omit<CustomerAccount, "createdAt">) {
    const validationError = validateCustomerAccount(account);

    if (validationError) {
      showAccountError(validationError);
      return;
    }

    const email = account.email.trim().toLowerCase();
    const firstName = account.firstName.trim();
    const lastName = account.lastName.trim();

    setIsAuthSubmitting(true);
    setAccountFormError(null);
    setAccountFormHelp(null);

    try {
      const result = await requestCustomerCode({
        email,
        firstName,
        lastName,
        purpose: "create",
      });

      setPendingAuth({ email, firstName, lastName, purpose: "create" });
      setAccountPromptMode("verify");
      setAccountPromptReason(`Enter the 6-digit code sent to ${email}.`);
      setAccountFormHelp(result.devCode ? `Development code: ${result.devCode}` : null);
    } catch (error) {
      showAccountError(error instanceof Error ? error.message : "Unable to send verification code.");
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function signInCustomer(emailInput: string) {
    const email = emailInput.trim().toLowerCase();

    if (!emailPattern.test(email)) {
      showAccountError("Enter a valid email address.");
      return;
    }

    setIsAuthSubmitting(true);
    setAccountFormError(null);
    setAccountFormHelp(null);

    try {
      const result = await requestCustomerCode({
        email,
        purpose: "sign-in",
      });

      setPendingAuth({ email, purpose: "sign-in" });
      setAccountPromptMode("verify");
      setAccountPromptReason(`Enter the 6-digit code sent to ${email}.`);
      setAccountFormHelp(result.devCode ? `Development code: ${result.devCode}` : null);
    } catch (error) {
      showAccountError(error instanceof Error ? error.message : "Unable to send sign-in code.");
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function verifyCustomerSignIn(codeInput: string) {
    const code = codeInput.trim();

    if (!pendingAuth) {
      showAccountError("Request a new sign-in code.");
      return;
    }

    if (!codePattern.test(code)) {
      showAccountError("Enter the 6-digit code from your email.");
      return;
    }

    setIsAuthSubmitting(true);
    setAccountFormError(null);

    try {
      const session = await verifyCustomerCode({ email: pendingAuth.email, code });
      setCustomerToken(session.token);
      setCustomerAccount(session.customer);
      if (pendingWishlistProductId) {
        setWishlist((items) => {
          const nextWishlist = items.includes(pendingWishlistProductId) ? items : [...items, pendingWishlistProductId];
          persistCustomerWishlist(nextWishlist, session.token);
          return nextWishlist;
        });
        setPendingWishlistProductId(null);
      }
      setAccountPromptReason(null);
      setPendingAuth(null);
      setAccountFormHelp(null);
      setCodeDraft({ code: "" });
      setSignInDraft({ email: "" });
      setAccountDraft({ email: "", firstName: "", lastName: "" });
      setAccountNotice({
        message: pendingAuth.purpose === "create" ? `Welcome, ${session.customer.firstName}.` : `Welcome back, ${session.customer.firstName}.`,
        detail: `You are signed in as ${session.customer.email}.`,
      });
    } catch (error) {
      showAccountError(error instanceof Error ? error.message : "Unable to verify code.");
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  function signOutCustomer() {
    if (customerAccount) {
      setAccountNotice({
        message: "Signed out.",
        detail: "Your cart stays saved on this browser.",
      });
    }

    if (customerToken) {
      void signOutCustomerSession(customerToken);
    }

    setCustomerToken(null);
    setCustomerAccount(null);
    setWishlist([]);
    setIsProfileOpen(false);
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
    openCustomerProfile,
    createCustomerAccount,
    signInCustomer,
    verifyCustomerSignIn,
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
            <h2>
              {accountPromptMode === "verify"
                ? "Enter your code"
                : accountPromptMode === "sign-in"
                  ? "Sign in"
                  : "Create your account"}
            </h2>
            <p>{accountPromptReason}</p>
            {accountPromptMode === "verify" ? (
              <form noValidate onSubmit={(event) => {
                event.preventDefault();
                void verifyCustomerSignIn(codeDraft.code);
              }}>
                {accountFormHelp && <p className="form-help">{accountFormHelp}</p>}
                <label>
                  Verification code
                  <input
                    value={codeDraft.code}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    onChange={(event) => {
                      setCodeDraft({ code: event.target.value.replace(/\D/g, "").slice(0, 6) });
                      setAccountFormError(null);
                    }}
                    autoComplete="one-time-code"
                    aria-invalid={accountFormError ? "true" : undefined}
                    required
                  />
                </label>
                <button className="primary-button" type="submit" disabled={isAuthSubmitting}>
                  {isAuthSubmitting ? "Verifying..." : "Verify and sign in"}
                </button>
                <button
                  className="text-button"
                  type="button"
                  disabled={isAuthSubmitting}
                  onClick={() => {
                    if (!pendingAuth) return;
                    if (pendingAuth.purpose === "create") {
                      void createCustomerAccount({
                        email: pendingAuth.email,
                        firstName: pendingAuth.firstName ?? "",
                        lastName: pendingAuth.lastName ?? "",
                      });
                      return;
                    }

                    void signInCustomer(pendingAuth.email);
                  }}
                >
                  Resend code
                </button>
              </form>
            ) : accountPromptMode === "sign-in" ? (
              <form noValidate onSubmit={(event) => {
                event.preventDefault();
                void signInCustomer(signInDraft.email);
              }}>
                <label>
                  Email
                  <input
                    type="email"
                    value={signInDraft.email}
                    onChange={(event) => {
                      setSignInDraft({ email: event.target.value });
                      setAccountFormError(null);
                    }}
                    autoComplete="email"
                    aria-invalid={accountFormError?.toLowerCase().includes("email") ? "true" : undefined}
                    required
                  />
                </label>
                <button className="primary-button" type="submit" disabled={isAuthSubmitting}>
                  {isAuthSubmitting ? "Sending code..." : "Send sign-in code"}
                </button>
                <button
                  className="text-button"
                  type="button"
                  disabled={isAuthSubmitting}
                  onClick={() => {
                    setAccountPromptMode("create");
                    setAccountFormError(null);
                    setAccountPromptReason("Create an account to save your wishlist and continue checkout.");
                  }}
                >
                  New here? Create account
                </button>
              </form>
            ) : (
              <form noValidate onSubmit={(event) => {
                event.preventDefault();
                void createCustomerAccount(accountDraft);
              }}>
                <label>
                  Email
                  <input
                    type="email"
                    value={accountDraft.email}
                    onChange={(event) => {
                      setAccountDraft((current) => ({ ...current, email: event.target.value }));
                      setAccountFormError(null);
                    }}
                    autoComplete="email"
                    aria-invalid={accountFormError?.toLowerCase().includes("email") ? "true" : undefined}
                    required
                  />
                </label>
                <label>
                  First name
                  <input
                    value={accountDraft.firstName}
                    onChange={(event) => {
                      setAccountDraft((current) => ({ ...current, firstName: event.target.value }));
                      setAccountFormError(null);
                    }}
                    autoComplete="given-name"
                    minLength={2}
                    aria-invalid={accountFormError?.toLowerCase().includes("first name") ? "true" : undefined}
                    required
                  />
                </label>
                <label>
                  Last name
                  <input
                    value={accountDraft.lastName}
                    onChange={(event) => {
                      setAccountDraft((current) => ({ ...current, lastName: event.target.value }));
                      setAccountFormError(null);
                    }}
                    autoComplete="family-name"
                    minLength={2}
                    aria-invalid={accountFormError?.toLowerCase().includes("last name") ? "true" : undefined}
                    required
                  />
                </label>
                <button className="primary-button" type="submit" disabled={isAuthSubmitting}>
                  {isAuthSubmitting ? "Sending code..." : "Send verification code"}
                </button>
                <button
                  className="text-button"
                  type="button"
                  disabled={isAuthSubmitting}
                  onClick={() => {
                    setAccountPromptMode("sign-in");
                    setAccountFormError(null);
                    setAccountPromptReason("Sign in with an email verification code.");
                  }}
                >
                  Already have an account? Sign in
                </button>
              </form>
            )}
          </section>
        </div>
      )}
      {isProfileOpen && customerAccount && (
        <div className="modal-backdrop account-gate-backdrop" role="dialog" aria-modal="true" aria-label="SEKANAE profile">
          <section className="account-gate-panel account-profile-panel">
            <button className="icon-button modal-close" type="button" aria-label="Close profile" onClick={() => setIsProfileOpen(false)}>
              ×
            </button>
            <p className="microcopy">SEKANAE profile</p>
            <h2>{customerAccount.firstName}'s account</h2>
            <dl className="profile-details">
              <div>
                <dt>Name</dt>
                <dd>{customerAccount.firstName} {customerAccount.lastName}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{customerAccount.email}</dd>
              </div>
              <div>
                <dt>Wishlist</dt>
                <dd>{wishlist.length} saved {wishlist.length === 1 ? "piece" : "pieces"}</dd>
              </div>
              <div>
                <dt>Cart</dt>
                <dd>{cartCount} {cartCount === 1 ? "item" : "items"}</dd>
              </div>
            </dl>
            {wishlistProducts.length > 0 && (
              <div className="profile-wishlist">
                <h3>Wishlist</h3>
                {wishlistProducts.map((product) => (
                  <div key={product.id}>
                    <a href={`/product/${product.slug}`} onClick={() => setIsProfileOpen(false)}>
                      <img src={product.images[0]} alt="" />
                      <span>{product.name}</span>
                    </a>
                    <button type="button" onClick={() => toggleWishlist(product.id)}>Remove</button>
                  </div>
                ))}
              </div>
            )}
            <div className="profile-actions">
              <a className="secondary-button" href="/checkout" onClick={() => setIsProfileOpen(false)}>Continue checkout</a>
              <button className="primary-button" type="button" onClick={signOutCustomer}>Sign out</button>
            </div>
          </section>
        </div>
      )}
      {accountNotice && (
        <div
          className={accountNotice.tone === "error" ? "account-toast account-toast-error" : "account-toast"}
          role={accountNotice.tone === "error" ? "alert" : "status"}
          aria-live={accountNotice.tone === "error" ? "assertive" : "polite"}
        >
          <div>
            <strong>{accountNotice.message}</strong>
            {accountNotice.detail && <span>{accountNotice.detail}</span>}
          </div>
          <button type="button" aria-label="Dismiss account message" onClick={() => setAccountNotice(null)}>
            ×
          </button>
        </div>
      )}
    </StoreContext.Provider>
  );
}
