import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getApiBaseUrl } from "../api/config";
import { formatCurrencyAmount } from "../utils/money";

type PromoCode = { code: string; percentage: number; minimumSubtotal: number; expiresAt: string | null; active: boolean };
type Draft = { code: string; percentage: string; minimumSubtotal: string; expiresAt: string; active: boolean };
const emptyDraft: Draft = { code: "", percentage: "10", minimumSubtotal: "0", expiresAt: "", active: true };
function localDate(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
export function PromoCodesPanel({ token }: { token: string }) {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const request = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${getApiBaseUrl()}/api/admin/promos${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}) }, signal: AbortSignal.timeout(10000) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? "Unable to save promo codes.");
    return payload.data as T;
  }, [token]);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { setPromos(await request<PromoCode[]>("")); setError(null); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to load promo codes."); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(null); setMessage(null);
    try {
      const code = draft.code.trim().toUpperCase();
      const promo = await request<PromoCode>(editing ? `/${encodeURIComponent(code)}` : "", { method: editing ? "PUT" : "POST", body: JSON.stringify({ code, percentage: Number(draft.percentage), minimumSubtotal: Number(draft.minimumSubtotal), expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null, active: draft.active }) });
      setPromos((current) => [promo, ...current.filter((item) => item.code !== promo.code)]);
      setMessage(`${promo.code} saved.`); setDraft(emptyDraft); setEditing(false);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save promo code."); }
    finally { setSaving(false); }
  }
  return <article className="admin-panel" id="promo-codes">
    <div className="panel-heading"><div><h2>Promo codes</h2><p className="admin-status admin-status-tight">Percentage discounts on merchandise. One code per order; shipping is excluded.</p></div><button type="button" onClick={() => void refresh()} disabled={loading || saving}>Refresh</button></div>
    <form className="admin-product-form admin-product-form-standalone" onSubmit={save}>
      <div className="admin-form-grid">
        <label>Code<input required maxLength={40} pattern="[A-Za-z0-9_-]{1,40}" title="Use letters, numbers, hyphens, or underscores." autoCapitalize="characters" value={draft.code} disabled={editing || saving} onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })} placeholder="WELCOME10" /></label>
        <label>Discount percentage<input required type="number" min="0.01" max="100" step="0.01" value={draft.percentage} disabled={saving} onChange={(event) => setDraft({ ...draft, percentage: event.target.value })} /></label>
        <label>Minimum merchandise subtotal (EUR)<input required type="number" min="0" max="10000000" step="0.01" value={draft.minimumSubtotal} disabled={saving} onChange={(event) => setDraft({ ...draft, minimumSubtotal: event.target.value })} /></label>
        <label>Expiry (your local time, optional)<input type="datetime-local" value={draft.expiresAt} disabled={saving} onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value })} /></label>
      </div>
      <div className="admin-checkboxes"><label><input type="checkbox" checked={draft.active} disabled={saving} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />Enabled</label></div>
      <button type="submit" disabled={saving || loading}>{saving ? "Saving…" : editing ? "Save promo code" : "Create promo code"}</button>
      {editing && <button type="button" disabled={saving} onClick={() => { setDraft(emptyDraft); setEditing(false); setError(null); }}>Cancel edit</button>}
    </form>
    {error && <p className="admin-status" role="alert">{error}</p>}
    {message && <p className="admin-status" role="status">{message}</p>}
    <div className="admin-promo-list">
      {loading ? <p role="status">Loading promo codes…</p> : promos.map((promo) => <div className="admin-promo-item" key={promo.code}><div><strong>{promo.code} · {promo.percentage}% off</strong><p>{!promo.active ? "Disabled" : promo.expiresAt && Date.parse(promo.expiresAt) <= Date.now() ? "Expired" : "Active"} · {promo.minimumSubtotal > 0 ? `${formatCurrencyAmount(promo.minimumSubtotal, "EUR")} minimum` : "No minimum spend"}</p>{promo.expiresAt && <p>Expires {new Date(promo.expiresAt).toLocaleString()}</p>}</div><button type="button" disabled={saving} aria-label={`Edit ${promo.code}`} onClick={() => { setDraft({ code: promo.code, percentage: String(promo.percentage), minimumSubtotal: String(promo.minimumSubtotal), expiresAt: localDate(promo.expiresAt), active: promo.active }); setEditing(true); setMessage(null); setError(null); }}>Edit</button></div>)}
      {!loading && !error && !promos.length && <p className="admin-empty">No promo codes yet. Create your first offer above.</p>}
    </div>
  </article>;
}
