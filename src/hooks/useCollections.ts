import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getApiBaseUrl } from "../api/config";
import { catalogChangedEvent, catalogChangedStorageKey } from "../api/catalog-events";
import type { Collection } from "../data/catalog";

export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { pathname } = useLocation();
  useEffect(() => {
    const refresh = () => setAttempt(value => value + 1);
    const onStorage = (event: StorageEvent) => { if (event.key === catalogChangedStorageKey) refresh(); };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener(catalogChangedEvent, refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(catalogChangedEvent, refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    let current = true;
    setLoading(true); setError(false);
    fetch(`${getApiBaseUrl()}/api/collections`, { signal: controller.signal, cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error("Collection unavailable"); return response.json() as Promise<{ data: Collection[] }>; })
      .then(({ data }) => { if (current) setCollections(data); })
      .catch(() => { if (current) { setCollections([]); setError(true); } })
      .finally(() => { window.clearTimeout(timeout); if (current) setLoading(false); });
    return () => { current = false; window.clearTimeout(timeout); controller.abort(); };
  }, [pathname, attempt]);
  return { collections, loading, error, retry: () => setAttempt(value => value + 1) };
}
