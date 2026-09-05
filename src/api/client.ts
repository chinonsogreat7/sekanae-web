import { type Product } from "../data/catalog";
import { getApiBaseUrl } from "./config";

type ApiResponse<TData> = {
  data: TData;
};

const apiBaseUrl = getApiBaseUrl();

export class ApiError extends Error {
  constructor(public status: number) { super("Unable to load the collection."); }
}

async function readApi<TData>(path: string): Promise<TData> {
  const response = await fetch(`${apiBaseUrl}${path}`, { signal: AbortSignal.timeout(10000), cache: "no-store" });

  if (!response.ok) {
    throw new ApiError(response.status);
  }

  const payload = await response.json() as ApiResponse<TData>;
  return payload.data;
}

export async function getProduct(slug: string): Promise<Product> {
  return readApi<Product>(`/api/products/${encodeURIComponent(slug)}`);
}

let catalogRequest: Promise<Product[]> | null = null;

export function getProducts(fresh = false): Promise<Product[]> {
  if (fresh) catalogRequest = null;
  if (!catalogRequest) {
    catalogRequest = (async () => {
      const products: Product[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = await readApi<Product[]>(`/api/products?limit=100&offset=${offset}`);
        products.push(...page);
        if (page.length < 100) return products;
      }
    })();
    const request = catalogRequest;
    void request.finally(() => {
      if (catalogRequest === request) catalogRequest = null;
    }).catch(() => undefined);
  }
  return catalogRequest;
}
