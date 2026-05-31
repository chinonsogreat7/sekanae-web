import { CheckCircle2, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { confirmCheckoutSession, getCheckoutOrder, type CheckoutOrder } from "../api/orders";
import { PageMeta } from "../components/PageMeta";
import { useStore } from "../context/store-context";
import { formatCurrencyAmount } from "../utils/money";

const pendingCheckoutStorageKey = "sekanae_pending_checkout";

function labelize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type PendingCheckout = {
  orderId: string;
  email: string;
  sessionId?: string;
};

function readPendingCheckout(): PendingCheckout | null {
  try {
    const storedValue = window.sessionStorage.getItem(pendingCheckoutStorageKey);
    return storedValue ? JSON.parse(storedValue) as PendingCheckout : null;
  } catch {
    return null;
  }
}

function readSessionIdFromUrl() {
  return new URLSearchParams(window.location.search).get("session_id");
}

export function CheckoutSuccessPage() {
  const { clearCart } = useStore();
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [statusMessage, setStatusMessage] = useState("Confirming your payment with Stripe.");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [pendingCheckout] = useState(() => readPendingCheckout());

  useEffect(() => {
    const sessionId = pendingCheckout?.sessionId ?? readSessionIdFromUrl();

    if (!pendingCheckout && !sessionId) {
      setStatusMessage("We could not find the checkout session on this browser.");
      return;
    }

    const checkout = pendingCheckout;
    let isCurrent = true;
    let attempts = 0;

    async function refreshOrder() {
      attempts += 1;

      try {
        const nextOrder = sessionId
          ? await confirmCheckoutSession(sessionId)
          : checkout
            ? await getCheckoutOrder(checkout.orderId, checkout.email)
            : null;
        if (!isCurrent) return;

        if (!nextOrder) {
          setStatusMessage("We could not find the checkout session on this browser.");
          return;
        }

        setOrder(nextOrder);

        if (nextOrder.paymentStatus === "paid") {
          clearCart();
          window.sessionStorage.removeItem(pendingCheckoutStorageKey);
          setIsConfirmed(true);
          setStatusMessage("Your payment is confirmed and your order is now with the SEKANAE studio.");
          return;
        }

        if (nextOrder.paymentStatus === "failed") {
          setStatusMessage("Stripe could not complete this payment. Please return to your cart and try again.");
          return;
        }

        if (attempts >= 6) {
          setStatusMessage("Stripe accepted the checkout, and we are still waiting for final confirmation.");
          return;
        }

        window.setTimeout(refreshOrder, 2500);
      } catch {
        if (!isCurrent) return;
        setStatusMessage("We could not refresh the order status yet. Your confirmation email will still arrive after Stripe confirms payment.");
      }
    }

    void refreshOrder();

    return () => {
      isCurrent = false;
    };
  }, [clearCart, pendingCheckout]);

  return (
    <div className="page section-pad">
      <PageMeta
        title="Checkout Confirmation"
        path="/checkout/success"
        description="Your SEKANAE checkout confirmation."
      />
      <section className="confirmation checkout-confirmation">
        {isConfirmed ? <CheckCircle2 size={42} /> : <Clock3 size={42} />}
        <p className="microcopy">Stripe checkout</p>
        <h1>{isConfirmed ? "Your order is confirmed." : "We are confirming your order."}</h1>
        <p>{statusMessage}</p>
        {order && (
          <dl className="confirmation-details">
            <div>
              <dt>Order reference</dt>
              <dd>{order.id.slice(0, 8).toUpperCase()}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{formatCurrencyAmount(order.total, order.currency)}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>{labelize(order.paymentStatus)}</dd>
            </div>
          </dl>
        )}
        <div className="confirmation-actions">
          <Link to="/shop" className="primary-button">Continue shopping</Link>
          <Link to="/client-care" className="secondary-button">Contact client care</Link>
        </div>
      </section>
    </div>
  );
}
