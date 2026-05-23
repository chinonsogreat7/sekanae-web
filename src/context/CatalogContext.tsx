import { useEffect, useState } from "react";
import { getProducts } from "../api/client";
import { products as fallbackProducts, type Product } from "../data/catalog";

type CatalogState = {
  products: Product[];
  error: string | null;
};

export function useCatalog(): CatalogState {
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    getProducts()
      .then((nextProducts) => {
        if (!isCurrent) return;
        setProducts(nextProducts);
        setError(null);
      })
      .catch(() => {
        if (!isCurrent) return;
        setProducts(fallbackProducts);
        setError("Catalog is using saved data while the API is unavailable.");
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  return { products, error };
}
