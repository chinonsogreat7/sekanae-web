import { CreditCard, LockKeyhole, Truck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { formatMoney } from "../utils/money";

export function CheckoutPage() {
  const { cartProducts, currency, subtotal, clearCart } = useStore();
  const [isComplete, setIsComplete] = useState(false);
  const shipping = subtotal > 500 ? 0 : 35;

  if (isComplete) {
    return (
      <div className="page section-pad">
        <section className="confirmation">
          <h1>Your order has been received.</h1>
          <p>
            Thank you for choosing SEKANAE. A confirmation note and international
            tracking details will be sent to your inbox.
          </p>
          <Link to="/shop" className="primary-button">Continue shopping</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page section-pad">
      <div className="checkout-layout">
        <section className="checkout-form">
          <h1>Secure Checkout</h1>
          <div className="checkout-assurance">
            <span><LockKeyhole size={16} /> Encrypted payment</span>
            <span><Truck size={16} /> International shipping</span>
            <span><CreditCard size={16} /> Card, PayPal, and bank options</span>
          </div>
          <form onSubmit={(event) => {
            event.preventDefault();
            clearCart();
            setIsComplete(true);
          }}>
            <div className="form-grid">
              <label>Email<input type="email" required placeholder="you@example.com" /></label>
              <label>Country / Region
                <select defaultValue="United States">
                  <option>United States</option>
                  <option>United Kingdom</option>
                  <option>Nigeria</option>
                  <option>United Arab Emirates</option>
                  <option>France</option>
                  <option>Singapore</option>
                </select>
              </label>
              <label>First name<input required /></label>
              <label>Last name<input required /></label>
              <label className="wide">Address<input required /></label>
              <label>City<input required /></label>
              <label>Postal code<input required /></label>
            </div>
            <h2>Payment</h2>
            <div className="form-grid">
              <label className="wide">Card number<input required placeholder="4242 4242 4242 4242" /></label>
              <label>Expiry<input required placeholder="MM / YY" /></label>
              <label>Security code<input required placeholder="CVC" /></label>
            </div>
            <button className="primary-button" type="submit">Place secure order</button>
          </form>
        </section>
        <aside className="summary-card">
          <h2>Order Summary</h2>
          {cartProducts.map((item) => (
            <div key={item.productId}>
              <span>{item.product.name} / {item.color} x {item.quantity}</span>
              <strong>{formatMoney(item.product.price * item.quantity, currency)}</strong>
            </div>
          ))}
          <div><span>Shipping</span><strong>{shipping === 0 ? "Complimentary" : formatMoney(shipping, currency)}</strong></div>
          <div className="summary-total"><span>Total</span><strong>{formatMoney(subtotal + shipping, currency)}</strong></div>
        </aside>
      </div>
    </div>
  );
}
