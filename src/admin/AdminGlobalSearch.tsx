import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import type { Product } from "../data/catalog";
import type { AdminRequest } from "../../packages/admin/src/workflows";

type Result = { group: string; title: string; detail: string; href: string };
export function AdminGlobalSearch({ request, products, adminBase }: { request: AdminRequest; products: Product[]; adminBase: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const latestRequest = useRef(request);
  useEffect(() => { latestRequest.current = request; }, [request]);
  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setError(""); setResults([]);
      try {
        const q = encodeURIComponent(value);
        const [orders, customers] = await Promise.all([
          latestRequest.current<Array<{ id: string; customer: { name: string }; status: string }>>(`/api/admin/orders?q=${q}&limit=5`, { signal: controller.signal }),
          latestRequest.current<Array<{ name?: string; email: string }>>(`/api/admin/customers?q=${q}&limit=5`, { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        const matches = products.filter((product) => [product.name, product.id, product.slug, product.category, product.material].some((field) => field.toLowerCase().includes(value.toLowerCase()))).slice(0, 5);
        setResults([
          ...matches.map((product) => ({ group: "Products", title: product.name, detail: `${product.category} · ${product.status ?? "published"}`, href: `${adminBase}/products/${encodeURIComponent(product.id)}` })),
          ...orders.data.map((order) => ({ group: "Orders", title: `#${order.id.slice(0, 8)} · ${order.customer.name}`, detail: order.status, href: `${adminBase}/orders?order=${encodeURIComponent(order.id)}` })),
          ...customers.data.map((customer) => ({ group: "Users", title: customer.name || customer.email, detail: customer.email, href: `${adminBase}/customers/${encodeURIComponent(customer.email)}` })),
        ]);
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Search is unavailable. Try again.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, products, adminBase]);
  return <div className="admin-global-search" onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label className="admin-search"><Search size={16} aria-hidden="true" />
      <input type="search" aria-label="Search products, orders and users" aria-controls="admin-search-results" aria-expanded={open && query.trim().length >= 2}
        placeholder="Search products, orders, users" value={query} onFocus={() => setOpen(true)}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); setLoading(event.target.value.trim().length >= 2); setResults([]); setError(""); }} />
    </label>
    {open && query.trim().length >= 2 && <section id="admin-search-results" className="admin-search-results" aria-label="Search results">
      <p role="status">{loading ? "Searching…" : error || (results.length ? `${results.length} result${results.length === 1 ? "" : "s"} · up to 5 per category` : "No matching products, orders or users.")}</p>
      {!loading && !error && ["Products", "Orders", "Users"].map((group) => {
        const items = results.filter((result) => result.group === group);
        return items.length > 0 && <div key={group}><strong>{group}</strong><ul>{items.map((result) => <li key={result.href}>
          <Link to={result.href} onClick={() => setOpen(false)}><span>{result.title}</span><small>{result.detail}</small></Link>
        </li>)}</ul></div>;
      })}
    </section>}
  </div>;
}
