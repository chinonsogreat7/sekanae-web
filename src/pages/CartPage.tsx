import { PromoCodeField } from "../components/PromoCodeField";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { QuoteSummary } from "../components/QuoteSummary";
import { useCartQuote } from "../hooks/useCartQuote";
import { PageMeta } from "../components/PageMeta";
import { useStore } from "../context/store-context";
import { formatMoney } from "../utils/money";

export function CartPage() {
  const { cartProducts, currency, exchangeRates, cartItems, updateQuantity, removeFromCart, toggleGiftWrap } = useStore();
  const hasCartItems = cartItems.length > 0;
  const quoteState = useCartQuote();

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
          {!hasCartItems ? (
            <div className="empty-state">
              <h2>Your cart is quiet.</h2>
              <p>Discover pieces designed for every destination.</p>
              <Link to="/shop" className="primary-button">Shop the collection</Link>
            </div>
          ) : (
            <div className="cart-list">
              {cartProducts.map((item) => (
                <article className="cart-item" key={`${item.productId}:${item.color}`}>
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
                    <button type="button" onClick={() => updateQuantity(item.productId, item.quantity - 1, item.color)} aria-label={`Decrease ${item.product.name} ${item.color} quantity`}>
                      <Minus size={14} />
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(item.productId, item.quantity + 1, item.color)} disabled={item.quantity >= 99} aria-label={`Increase ${item.product.name} ${item.color} quantity`}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <strong>{formatMoney(item.product.price * item.quantity, currency, exchangeRates)}</strong>
                  <button className="icon-button" type="button" onClick={() => removeFromCart(item.productId, item.color)} aria-label={`Remove ${item.product.name} ${item.color}`}>
                    <Trash2 size={18} />
                  </button>
                </article>
              ))}
              {cartItems.filter((item) => !cartProducts.some((known) => known.productId === item.productId)).map((item) => <article className="cart-item" key={`${item.productId}:${item.color}`}><p>This piece is no longer available ({item.color}).</p><button type="button" className="secondary-button" onClick={() => removeFromCart(item.productId, item.color)}>Remove unavailable piece</button></article>)}
            </div>
          )}
        </section>
        <aside className="summary-card">
          <h2>Order Summary</h2>
          {hasCartItems && <PromoCodeField quote={quoteState.quote} loading={quoteState.loading} />}
          {hasCartItems ? (
            <>
              <QuoteSummary {...quoteState} />
              {quoteState.quote?.canCheckout ? <Link to="/checkout" className="primary-button">Continue to checkout</Link> : <button className="primary-button" type="button" disabled>Continue to checkout</button>}
            </>
          ) : (
            <>
              <p className="summary-note">Add a piece to your cart before checkout. Shipping and totals will update once there is something to send.</p>
              <div><span>International shipping</span><strong>Not calculated</strong></div>
              <div className="summary-total"><span>Total</span><strong>{formatMoney(0, currency, exchangeRates)}</strong></div>
              <Link to="/shop" className="primary-button">Shop the collection</Link>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
