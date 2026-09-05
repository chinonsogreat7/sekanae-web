import { PromoCodeField } from "../components/PromoCodeField";
import { CreditCard, LockKeyhole, Truck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { createCheckoutOrder, createCheckoutSession, type CheckoutAddress } from "../api/orders";
import { CustomSelect } from "../components/CustomSelect";
import { PageMeta } from "../components/PageMeta";
import { useStore } from "../context/store-context";
import { QuoteSummary } from "../components/QuoteSummary";
import { useCartQuote } from "../hooks/useCartQuote";

const pendingCheckoutStorageKey = "sekanae_pending_checkout";

function readFormValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function buildCheckoutAddress(formData: FormData): CheckoutAddress {
  const line2 = readFormValue(formData, "addressLine2");
  const region = readFormValue(formData, "region");
  const postalCode = readFormValue(formData, "postalCode");

  return {
    line1: readFormValue(formData, "addressLine1"),
    ...(line2 ? { line2 } : {}),
    city: readFormValue(formData, "city"),
    ...(region ? { region } : {}),
    ...(postalCode ? { postalCode } : {}),
    country: readFormValue(formData, "country"),
  };
}

export function CheckoutPage() {
  const {
    cartProducts,
    currency,
    cartItems,
    customerAccount,
    openAccountPrompt,
  } = useStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const hasCartItems = cartItems.length > 0;
  const quoteState = useCartQuote();
  const hasGiftWrap = cartProducts.some((item) => item.giftWrap);

  async function handleCheckoutSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasCartItems) {
      setCheckoutError("Add a piece to your cart before checkout.");
      return;
    }

    if (!quoteState.quote?.canCheckout) {
      setCheckoutError("Please wait for your order summary or try refreshing it.");
      return;
    }

    setIsSubmitting(true);
    setCheckoutError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const firstName = readFormValue(formData, "firstName");
      const lastName = readFormValue(formData, "lastName");
      const email = (customerAccount?.email ?? readFormValue(formData, "email")).toLowerCase();
      const phone = readFormValue(formData, "phone");
      const giftWrapItems = cartProducts
        .filter((item) => item.giftWrap)
        .map((item) => `${item.product.name} (${item.color})`);
      const notes = [
        readFormValue(formData, "notes"),
        giftWrapItems.length > 0 ? `Gift packaging requested for: ${giftWrapItems.join(", ")}.` : "",
      ].filter(Boolean).join("\n");
      const order = await createCheckoutOrder({
        currency,
        expectedTotal: quoteState.quote.total,
        promoCode: quoteState.quote.promoCode,
        customer: {
          email,
          name: `${firstName} ${lastName}`.trim(),
          ...(phone ? { phone } : {}),
        },
        shippingAddress: buildCheckoutAddress(formData),
        billingAddress: buildCheckoutAddress(formData),
        items: cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          color: item.color,
        })),
        ...(notes ? { notes } : {}),
        marketingOptIn: formData.get("marketingOptIn") === "on",
      });
      const session = await createCheckoutSession(order.id, email);

      window.sessionStorage.setItem(
        pendingCheckoutStorageKey,
        JSON.stringify({ orderId: order.id, email, sessionId: session.id }),
      );

      if (!session.url) {
        throw new Error("Stripe did not return a checkout link.");
      }

      window.location.assign(session.url);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to start checkout. Please try again.");
      setIsSubmitting(false);
      quoteState.retry();
    }
  }

  return (
    <div className="page section-pad">
      <PageMeta
        title="Secure Checkout"
        path="/checkout"
        description="Complete secure checkout for selected SEKANAE accessories with international shipping."
      />
      <div className="checkout-layout">
        <section className="checkout-form">
          <h1>Secure Checkout</h1>
          <div className="checkout-assurance">
            <span><LockKeyhole size={16} /> Encrypted payment</span>
            <span><Truck size={16} /> International shipping</span>
            <span><CreditCard size={16} /> Secure Stripe checkout</span>
          </div>
          {!hasCartItems ? (
            <div className="empty-state checkout-gate">
              <h2>Your cart is quiet.</h2>
              <p>Add a piece before continuing to checkout.</p>
              <Link to="/shop" className="primary-button">Shop the collection</Link>
            </div>
          ) : (
          <form onSubmit={handleCheckoutSubmit}>
            {customerAccount ? <div className="checkout-account-status" role="status">
              <div>
                <strong>Signed in as {customerAccount.firstName} {customerAccount.lastName}</strong>
                <span>{customerAccount.email}</span>
              </div>
              <button
                type="button"
                onClick={() => openAccountPrompt("Sign in with another email verification code.", "sign-in")}
              >
                Switch account
              </button>
            </div>
            : <div className="checkout-account-status"><div><strong>Guest checkout</strong><span>No account needed. We’ll email your order confirmation.</span></div><button type="button" onClick={() => openAccountPrompt("Sign in to use your saved details.", "sign-in")}>Already a customer? Sign in</button></div>}
            <div className="checkout-section-heading">
              <h2>Delivery details</h2>
              <p>We use these details for shipping and order updates before handing payment to Stripe.</p>
            </div>
            <div className="form-grid">
              <label>
                Email address
                <input
                  type="email"
                  name="email"
                  required
                  defaultValue={customerAccount?.email ?? ""}
                  key={customerAccount?.email ?? "guest"}
                  autoComplete="email"
                  readOnly={Boolean(customerAccount)}
                  className={customerAccount ? "checkout-locked-input" : undefined}
                />
              </label>
              <CustomSelect
                label="Country / Region"
                name="country"
                defaultValue="United States"
                options={[
                  "United States",
                  "United Kingdom",
                  "Nigeria",
                  "United Arab Emirates",
                  "France",
                  "Singapore",
                ]}
              />
              <label>First name<input key={`first-${customerAccount?.email ?? "guest"}`} name="firstName" required defaultValue={customerAccount?.firstName ?? ""} autoComplete="given-name" /></label>
              <label>Last name<input key={`last-${customerAccount?.email ?? "guest"}`} name="lastName" required defaultValue={customerAccount?.lastName ?? ""} autoComplete="family-name" /></label>
              <label>Phone<input name="phone" type="tel" autoComplete="tel" placeholder="For delivery updates" /></label>
              <label className="wide">Address<input name="addressLine1" required autoComplete="address-line1" /></label>
              <label className="wide">Apartment, suite, or delivery note<input name="addressLine2" autoComplete="address-line2" /></label>
              <label>City<input name="city" required autoComplete="address-level2" /></label>
              <label>State / Region<input name="region" autoComplete="address-level1" /></label>
              <label>Postal code<input name="postalCode" autoComplete="postal-code" /></label>
              <label className="wide">Order note<textarea name="notes" placeholder="Delivery preferences, engraving notes, or timing requests" /></label>
            </div>
            <h2>Payment</h2>
            <div className="stripe-handoff">
              <CreditCard size={22} />
              <div>
                <strong>Secure payment opens with Stripe.</strong>
                <p>Cards and available local payment methods are collected by Stripe, not stored by SEKANAE.</p>
              </div>
            </div>
            <label className="checkbox-row checkout-checkbox">
              <input name="marketingOptIn" type="checkbox" />
              Send me collection notes and early access updates.
            </label>
            {checkoutError && <p className="api-status api-status-error" role="alert">{checkoutError}</p>}
            <button className="primary-button" type="submit" disabled={isSubmitting || !quoteState.quote?.canCheckout}>
              {isSubmitting ? "Preparing secure payment..." : "Continue to secure payment"}
            </button>
          </form>
          )}
        </section>
        <aside className="summary-card">
          <h2>Order Summary</h2>
          {hasCartItems && <PromoCodeField quote={quoteState.quote} loading={quoteState.loading} disabled={isSubmitting} />}
          {hasCartItems ? <QuoteSummary {...quoteState} /> : <p className="summary-note">Add a piece to see delivery and payment options.</p>}
          {hasGiftWrap && <div><span>Gift packaging</span><strong>Included by request</strong></div>}
        </aside>
      </div>
    </div>
  );
}
