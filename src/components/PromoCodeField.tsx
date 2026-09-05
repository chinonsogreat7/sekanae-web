import { useState, type FormEvent } from "react";
import { useStore } from "../context/store-context";
import type { CartQuote } from "../api/orders";

type Props = { quote: CartQuote | null; loading: boolean; disabled?: boolean };
export function PromoCodeField({ quote, loading, disabled }: Props) {
  const { promoCode, setPromoCode } = useStore();
  const [draft, setDraft] = useState(promoCode);
  function apply(event: FormEvent) {
    event.preventDefault();
    const code = draft.trim().toUpperCase();
    if (code) { setDraft(code); setPromoCode(code); }
  }
  return <section className="promo-code-field" aria-label="Promo code">
    <form onSubmit={apply}>
      <label htmlFor="promo-code">Promo code</label>
      <div className="promo-code-input">
        <input id="promo-code" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={40} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="Enter your code" disabled={disabled || loading} />
        <button className="secondary-button" type="submit" disabled={disabled || loading || !draft.trim() || draft.trim().toUpperCase() === promoCode}>Apply</button>
      </div>
    </form>
    {promoCode && <p className="promo-code-status" role="status"><span>{loading ? `Checking ${promoCode}…` : quote?.promoCode === promoCode ? `${promoCode} applied` : `Code: ${promoCode}`}</span><button type="button" className="text-button" disabled={disabled} onClick={() => { setPromoCode(""); setDraft(""); }}>Remove</button></p>}
  </section>;
}
