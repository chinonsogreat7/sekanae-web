import { products, type Product } from "../data/catalog";
import { getApiBaseUrl } from "./config";

type ApiResponse<TData> = {
  data: TData;
};

const apiBaseUrl = getApiBaseUrl();

async function readApi<TData>(path: string): Promise<TData> {
  const response = await fetch(`${apiBaseUrl}${path}`);

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  const payload = await response.json() as ApiResponse<TData>;
  return payload.data;
}

export async function getProduct(slug: string): Promise<Product> {
  return readApi<Product>(`/api/products/${encodeURIComponent(slug)}`);
}

export async function getProducts(): Promise<Product[]> {
  return readApi<Product[]>("/api/products?limit=100");
}

export function getFallbackProducts() {
  return products;
}
