import { CreditCard, LockKeyhole, Truck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { createCheckoutOrder, createCheckoutSession, type CheckoutAddress } from "../api/orders";
import { CustomSelect } from "../components/CustomSelect";
import { PageMeta } from "../components/PageMeta";
import { useStore } from "../context/store-context";
import { formatMoney } from "../utils/money";

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
    exchangeRates,
    defaultShippingAmount,
    subtotal,
    customerAccount,
    openAccountPrompt,
  } = useStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const hasCartItems = cartProducts.length > 0;
  const shipping = hasCartItems ? defaultShippingAmount : 0;
  const hasGiftWrap = cartProducts.some((item) => item.giftWrap);

  async function handleCheckoutSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasCartItems) {
      setCheckoutError("Add a piece to your cart before checkout.");
      return;
    }

    if (!customerAccount) {
      openAccountPrompt("Create an account to continue to checkout.");
      return;
    }

    setIsSubmitting(true);
    setCheckoutError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const firstName = readFormValue(formData, "firstName");
      const lastName = readFormValue(formData, "lastName");
      const email = customerAccount.email.toLowerCase();
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
        customer: {
          email,
          name: `${firstName} ${lastName}`.trim(),
          ...(phone ? { phone } : {}),
        },
        shippingAddress: buildCheckoutAddress(formData),
        billingAddress: buildCheckoutAddress(formData),
        items: cartProducts.map((item) => ({
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
          ) : !customerAccount ? (
            <div className="empty-state checkout-gate">
              <h2>Create an account to checkout.</h2>
              <p>Your cart is saved in this browser. Create an account before placing an order so we can keep your order history and delivery details together.</p>
              <button className="primary-button" type="button" onClick={() => openAccountPrompt("Create an account to continue to checkout.")}>
                Create account
              </button>
            </div>
          ) : (
          <form onSubmit={handleCheckoutSubmit}>
            <div className="checkout-account-status" role="status">
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
            <div className="checkout-section-heading">
              <h2>Delivery details</h2>
              <p>We use these details for shipping and order updates before handing payment to Stripe.</p>
            </div>
            <div className="form-grid">
              <label>
                Account email
                <input
                  type="email"
                  name="email"
                  required
                  value={customerAccount.email}
                  autoComplete="email"
                  readOnly
                  className="checkout-locked-input"
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
              <label>First name<input name="firstName" required defaultValue={customerAccount.firstName} autoComplete="given-name" /></label>
              <label>Last name<input name="lastName" required defaultValue={customerAccount.lastName} autoComplete="family-name" /></label>
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
              <input name="marketingOptIn" type="checkbox" defaultChecked />
              Send me collection notes and early access updates.
            </label>
            {checkoutError && <p className="api-status api-status-error">{checkoutError}</p>}
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Opening Stripe..." : "Continue to secure payment"}
            </button>
          </form>
          )}
        </section>
        <aside className="summary-card">
          <h2>Order Summary</h2>
          {hasCartItems ? (
            cartProducts.map((item) => (
              <div key={item.productId}>
                <span>{item.product.name} / {item.color} x {item.quantity}</span>
                <strong>{formatMoney(item.product.price * item.quantity, currency, exchangeRates)}</strong>
              </div>
            ))
          ) : (
            <p className="summary-note">No checkout is needed yet. Add a piece to see shipping, taxes, and payment options.</p>
          )}
          <div><span>Shipping</span><strong>{hasCartItems ? (shipping === 0 ? "Complimentary" : formatMoney(shipping, currency, exchangeRates)) : "Not calculated"}</strong></div>
          {hasGiftWrap && (
            <div><span>Gift packaging</span><strong>Included by request</strong></div>
          )}
          <div className="summary-total"><span>Total</span><strong>{formatMoney(subtotal + shipping, currency, exchangeRates)}</strong></div>
        </aside>
      </div>
    </div>
  );
}
