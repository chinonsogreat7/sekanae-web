import { useEffect, useRef, useState } from "react";
import type { AdminRequest } from "../../packages/admin/src/workflows";
import type { Collection, Product } from "../data/catalog";

type ArchivedItem = { id: string; name: string; image?: string; detail: string };

export function ArchivedCatalogPanel({ kind, request, onBack, onRestored }: {
  kind: "products" | "collections";
  request: AdminRequest;
  onBack: () => void;
  onRestored: (id: string) => Promise<void>;
}) {
  const [items, setItems] = useState<ArchivedItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const requestRef = useRef(request);
  useEffect(() => { requestRef.current = request; }, [request]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    requestRef.current<Array<Product | Collection>>(`/api/admin/${kind}?archived=true`, { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setItems(data.map(item => "name" in item
          ? { id: item.id, name: item.name, image: item.images[0], detail: `${item.category} · Stock: ${item.stock} · Restores as ${item.status ?? "published"}` }
          : { id: item.id, name: item.title, image: item.image, detail: item.description }));
      }).catch(() => { if (!controller.signal.aborted) setError(`Archived ${kind} couldn’t load. Please try again.`); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind, attempt]);

  async function restore(item: ArchivedItem) {
    setBusy(item.id); setMessage("");
    try {
      await requestRef.current(`/api/admin/${kind}/${encodeURIComponent(item.id)}/restore`, { method: "POST" });
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Unarchive failed. Please try again.");
      setBusy(null);
      return;
    }
    setItems(current => current.filter(row => row.id !== item.id));
    setMessage(`${item.name} unarchived. You can find it in Active ${kind}.`);
    try { await onRestored(item.id); }
    catch { setMessage(`${item.name} unarchived. Refresh the active list to see it.`); }
    finally { setBusy(null); }
  }

  const visible = items.filter(item => `${item.name} ${item.detail}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="admin-panel admin-archived-catalog">
    <div className="panel-heading">
      <div><h2>Archived {kind}</h2><p className="admin-status admin-status-tight">{kind === "products" ? "Unarchive restores each product’s previous publication status. Published products become visible in the shop; drafts stay hidden." : "Unarchive makes the collection visible again. Its saved details and display order are preserved."}</p></div>
      <button type="button" onClick={onBack}>Active {kind}</button>
    </div>
    <div className="admin-archive-tools">
      <label>Search archived {kind}<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name…" /></label>
      <button type="button" disabled={loading || Boolean(busy)} onClick={() => setAttempt(value => value + 1)}>Refresh</button>
    </div>
    {message && <p className="admin-status" role="status">{message}</p>}
    {loading ? <p role="status">Loading archived {kind}…</p> : error ? <p role="alert">{error}</p> : <>
      <p className="admin-status">{visible.length} of {items.length} archived {kind}</p>
      <div className="admin-archive-list">{visible.map(item => <article key={item.id}>
        {item.image && <img src={item.image} alt="" />}
        <div><h3>{item.name}</h3><span className="admin-status-pill">Archived</span><p>{item.detail}</p></div>
        <button type="button" disabled={Boolean(busy)} onClick={() => restore(item)} aria-label={`Unarchive ${item.name}`}>{busy === item.id ? "Unarchiving…" : "Unarchive"}</button>
      </article>)}</div>
      {!visible.length && <p className="admin-empty">{items.length ? "No archived items match your search." : `No archived ${kind}.`}</p>}
    </>}
  </section>;
}
