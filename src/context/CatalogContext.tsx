import { createContext, useContext } from "react";
import type { Product } from "../data/catalog";

export type CatalogState = {
  products: Product[];
  error: string | null;
  loading: boolean;
  retry: () => void;
};
export const CatalogContext = createContext<CatalogState | null>(null);
export function useCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error("CatalogProvider is required");
  return value;
}
