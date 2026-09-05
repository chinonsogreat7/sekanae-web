import { useCallback, useEffect, useState } from "react";
import { getCartQuote, type CartQuote } from "../api/orders";
import { useStore } from "../context/store-context";

export function useCartQuote() {
  const { cartItems, currency, promoCode } = useStore();
  const inputKey = JSON.stringify({ currency, ...(promoCode ? { promoCode } : {}), items: cartItems.map(({ productId, color, quantity }) => ({ productId, color, quantity })) });
  const [result, setResult] = useState<{ key: string; quote: CartQuote | null; error: string | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => { setResult(null); setAttempt((value) => value + 1); }, []);
  useEffect(() => {
    let current = true;
    const input = JSON.parse(inputKey);
    if (!input.items.length) return;
    getCartQuote(input).then((quote) => {
      if (current) setResult({ key: inputKey, quote, error: null });
    }).catch((error: unknown) => {
      if (current) setResult({ key: inputKey, quote: null, error: error instanceof Error ? error.message : "We couldn’t confirm prices and delivery. Please try again." });
    });
    return () => { current = false; };
  }, [inputKey, attempt]);
  const current = result?.key === inputKey ? result : null;
  return { quote: current?.quote ?? null, error: current?.error ?? null, loading: cartItems.length > 0 && !current, retry };
}
