import { useEffect, useRef, useState } from "react";
import { emptyOrderFilters, orderFiltersSchema, orderStatuses, paymentStatuses, type AdminRequest, type OrderFilters, type SavedWork, type SavedWorkSummary } from "../../packages/admin/src/workflows";

function label(value: string) { return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
export function OrderFiltersPanel({ filters, request, onApply, loading }: { filters: OrderFilters; request: AdminRequest; onApply: (filters: OrderFilters) => void; loading: boolean }) {
  const [draft, setDraft] = useState(filters);
  const [views, setViews] = useState<SavedWorkSummary[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const requestRef = useRef(request);
  useEffect(() => { requestRef.current = request; }, [request]);
  useEffect(() => {
    const controller = new AbortController();
    requestRef.current<SavedWorkSummary[]>("/api/admin/saved-work?kind=order_view", { signal: controller.signal })
      .then((response) => setViews(response.data)).catch(() => { if (!controller.signal.aborted) setMessage("Saved views could not load. Refresh to try again."); });
    return () => controller.abort();
  }, []);
  function apply(value: OrderFilters) {
    const parsed = orderFiltersSchema.safeParse(value);
    if (!parsed.success) { setMessage(parsed.error.issues[0].message); return; }
    setMessage(""); setDraft(parsed.data); onApply(parsed.data);
  }
  async function saveView() {
    const parsed = orderFiltersSchema.safeParse(draft);
    if (!name.trim()) { setMessage("Name this view before saving."); return; }
    if (!parsed.success) { setMessage(parsed.error.issues[0].message); return; }
    setBusy(true);
    try {
      const response = await request<SavedWork>("/api/admin/saved-work", { method: "POST", body: JSON.stringify({ kind: "order_view", name: name.trim(), payload: parsed.data }) });
      setViews((current) => [response.data, ...current]); setName(""); setMessage("View saved. It will be available next time you sign in.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save view."); }
    finally { setBusy(false); }
  }
  async function resume(view: SavedWorkSummary) {
    setBusy(true);
    try {
      const response = await request<SavedWork>(`/api/admin/saved-work/${view.id}`);
      if (response.data.kind === "order_view") apply(response.data.payload);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to open view."); }
    finally { setBusy(false); }
  }
  async function remove(view: SavedWorkSummary) {
    if (!window.confirm(`Remove saved view “${view.name}”? Orders will not be changed.`)) return;
    setBusy(true);
    try {
      await request(`/api/admin/saved-work/${view.id}`, { method: "DELETE", body: JSON.stringify({ revision: view.revision }) });
      setViews((current) => current.filter((item) => item.id !== view.id)); setMessage("Saved view removed.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to remove view."); }
    finally { setBusy(false); }
  }
  return <div className="admin-order-filters">
    <form onSubmit={(event) => { event.preventDefault(); apply(draft); }}>
      <div className="admin-order-filter-grid">
        <label>Order number or customer<input type="search" value={draft.q} maxLength={200} placeholder="Order ID, name or email" onChange={(event) => setDraft({ ...draft, q: event.target.value })} /></label>
        <label>Customer email<input type="email" value={draft.email} placeholder="Exact email address" onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label>
        <label>Order status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as OrderFilters["status"] })}><option value="">All statuses</option>{orderStatuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label>
        <label>Payment status<select value={draft.paymentStatus} onChange={(event) => setDraft({ ...draft, paymentStatus: event.target.value as OrderFilters["paymentStatus"] })}><option value="">All payment states</option>{paymentStatuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label>
        <label>From date (UTC)<input type="date" value={draft.from} max={draft.to || undefined} onChange={(event) => setDraft({ ...draft, from: event.target.value })} /></label>
        <label>To date (UTC)<input type="date" value={draft.to} min={draft.from || undefined} onChange={(event) => setDraft({ ...draft, to: event.target.value })} /></label>
      </div>
      <div className="admin-bulk-actions"><button type="submit" disabled={loading || busy}>Apply filters</button><button type="button" disabled={loading || busy} onClick={() => apply(emptyOrderFilters)}>Clear filters</button>
        <button type="button" disabled={loading || busy} onClick={() => apply({ ...emptyOrderFilters, status: "paid", paymentStatus: "paid" })}>Paid, awaiting processing</button>
        <button type="button" disabled={loading || busy} onClick={() => apply({ ...emptyOrderFilters, status: "processing", paymentStatus: "paid" })}>Ready for fulfillment</button>
      </div>
    </form>
    <details><summary>Saved order views ({views.length})</summary>
      <form className="admin-save-view" onSubmit={(event) => { event.preventDefault(); void saveView(); }}><label>View name<input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} placeholder="e.g. September paid orders" /></label><button type="submit" disabled={busy}>Save current filters</button></form>
      <ul className="admin-saved-list">{views.map((view) => <li key={view.id}><button type="button" disabled={busy || loading} onClick={() => void resume(view)}>{view.name}</button><button type="button" disabled={busy} aria-label={`Remove view ${view.name}`} onClick={() => void remove(view)}>Remove</button></li>)}</ul>
    </details>
    {message && <p className="admin-status" role="status">{message}</p>}
  </div>;
}
