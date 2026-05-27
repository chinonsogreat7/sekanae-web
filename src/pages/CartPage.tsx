import { Minus, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { PageMeta } from "../components/PageMeta";
import { useStore } from "../context/StoreContext";
import { formatMoney } from "../utils/money";

export function CartPage() {
  const { cartProducts, currency, exchangeRates, defaultShippingAmount, subtotal, updateQuantity, removeFromCart, toggleGiftWrap } = useStore();
  const shipping = defaultShippingAmount;

  return (
    <div className="page section-pad">
      <PageMeta
        title="Your Cart"
        path="/cart"
        description="Review selected SEKANAE accessories, gift packaging, shipping, and checkout details."
      />
      <div className="cart-layout">
        <section>
          <h1>Your Cart</h1>
          <p className="cart-intro">Review your SEKANAE pieces, select gift packaging, and continue to secure checkout.</p>
          {cartProducts.length === 0 ? (
            <div className="empty-state">
              <h2>Your cart is quiet.</h2>
              <p>Discover pieces designed for every destination.</p>
              <Link to="/shop" className="primary-button">Shop the collection</Link>
            </div>
          ) : (
            <div className="cart-list">
              {cartProducts.map((item) => (
                <article className="cart-item" key={item.productId}>
                  <img src={item.product.images[0]} alt={item.product.name} />
                  <div>
                    <h2>{item.product.name}</h2>
                    <p>{item.product.category} / {item.color}</p>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={item.giftWrap}
                        onChange={() => toggleGiftWrap(item.productId, item.color)}
                      />
                      Luxury gift packaging request
                    </label>
                  </div>
                  <div className="quantity-control" aria-label={`${item.product.name} quantity`}>
                    <button type="button" onClick={() => updateQuantity(item.productId, item.quantity - 1, item.color)} aria-label="Decrease quantity">
                      <Minus size={14} />
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(item.productId, item.quantity + 1, item.color)} aria-label="Increase quantity">
                      <Plus size={14} />
                    </button>
                  </div>
                  <strong>{formatMoney(item.product.price * item.quantity, currency, exchangeRates)}</strong>
                  <button className="icon-button" type="button" onClick={() => removeFromCart(item.productId, item.color)} aria-label="Remove item">
                    <Trash2 size={18} />
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
        <aside className="summary-card">
          <h2>Order Summary</h2>
          <div><span>Subtotal</span><strong>{formatMoney(subtotal, currency, exchangeRates)}</strong></div>
          <div><span>International shipping</span><strong>{shipping === 0 ? "Complimentary" : formatMoney(shipping, currency, exchangeRates)}</strong></div>
          <label>
            Promo code
            <input type="text" placeholder="Enter code" />
          </label>
          <div className="summary-total"><span>Total</span><strong>{formatMoney(subtotal + shipping, currency, exchangeRates)}</strong></div>
          <Link to="/checkout" className="primary-button">Continue to checkout</Link>
        </aside>
      </div>
    </div>
  );
}
