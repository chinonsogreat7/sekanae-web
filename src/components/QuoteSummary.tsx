import type { CartQuote } from "../api/orders";
import { formatCurrencyAmount } from "../utils/money";

type Props = { quote: CartQuote | null; loading: boolean; error: string | null; retry: () => void };
export function QuoteSummary({ quote, loading, error, retry }: Props) {
  if (loading) return <p role="status">Checking prices and delivery…</p>;
  if (error) return <section role="alert"><p>{error}</p><button type="button" className="secondary-button" onClick={retry}>Try again</button></section>;
  if (!quote) return null;
  const money = (amount: number) => formatCurrencyAmount(amount, quote.currency);
  return <>
    {quote.items.map((item, index) => <div key={`${item.productId}:${item.color}:${index}`}>
      <span>{item.name} / {item.color} × {item.quantity}{!item.isAvailable && <strong className="quote-item-error">{item.message}</strong>}</span>
      <strong>{item.isAvailable ? money(item.lineTotal) : "Unavailable"}</strong>
    </div>)}
    {quote.canCheckout ? <>
      <div><span>Subtotal</span><strong>{money(quote.subtotal)}</strong></div>
      {quote.discount > 0 && <div className="promo-discount-row"><span>Promo ({quote.promoCode})</span><strong>−{money(quote.discount)}</strong></div>}
      <div><span>Shipping</span><strong>{quote.shipping === 0 ? "Complimentary" : money(quote.shipping)}</strong></div>
      <div><span>{quote.taxIncluded ? "VAT included" : "VAT"}</span><strong>{money(quote.tax)}</strong></div>
      <div className="summary-total"><span>Total</span><strong>{money(quote.total)}</strong></div>
    </> : <p role="alert">Please update unavailable items in your cart before checkout.</p>}
  </>;
}
