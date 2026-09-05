import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { getProducts } from "../api/client";
import { catalogChangedEvent, catalogChangedStorageKey } from "../api/catalog-events";
import type { Product } from "../data/catalog";
import { CatalogContext } from "./CatalogContext";

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const { pathname } = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    const onCatalogChanged = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      setProducts((current) => current.filter((product) => product.id !== id));
      retry();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== catalogChangedStorageKey) return;
      // Clear stale data while the other tab's change is revalidated.
      setProducts([]);
      retry();
    };
    const onVisible = () => { if (document.visibilityState === "visible") retry(); };
    window.addEventListener(catalogChangedEvent, onCatalogChanged);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", retry);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(catalogChangedEvent, onCatalogChanged);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", retry);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [retry]);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    getProducts(true).then((items) => {
      if (!current) return;
      setProducts(items);
      setError(null);
    }).catch(() => {
      if (!current) return;
      setProducts([]);
      setError("We couldn’t load the collection. Please try again.");
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [attempt, pathname]);
  return <CatalogContext.Provider value={{ products, error, loading, retry }}>{children}</CatalogContext.Provider>;
}
