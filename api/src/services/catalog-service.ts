import { collections, products, type Product, type ProductCategory } from "../../../packages/catalog/src/index.js";
import { hasDatabase } from "../db/pool.js";
import {
  getProductByIdFromDatabase,
  getProductBySlugFromDatabase,
  listCollectionsFromDatabase,
  listProductsFromDatabase,
} from "../repositories/catalog-repository.js";

export type ProductSort = "featured" | "new" | "price-asc" | "price-desc" | "name";

export type ProductFilters = {
  category?: ProductCategory;
  collection?: string;
  color?: string;
  material?: string;
  occasion?: string;
  q?: string;
  sort?: ProductSort;
  limit?: number;
  offset?: number;
};

export type ProductListMeta = {
  total: number;
  limit: number;
  offset: number;
  categories: ProductCategory[];
  colors: string[];
  materials: string[];
  occasions: string[];
  tags: string[];
};

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function listProductsFromFallback(filters: ProductFilters): { items: Product[]; meta: ProductListMeta } {
  const query = filters.q?.trim().toLowerCase();

  const filtered = products.filter((product) => {
    if (filters.category && product.category !== filters.category) return false;
    if (filters.collection && product.collection !== filters.collection) return false;
    if (filters.color && !product.colors.includes(filters.color)) return false;
    if (filters.material && product.material !== filters.material) return false;
    if (filters.occasion && !product.occasion.includes(filters.occasion)) return false;
    if (!query) return true;

    return [product.name, product.category, product.collection, product.description, product.material]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (filters.sort) {
      case "new":
        return Number(Boolean(b.isNew || b.isBridalPreview)) - Number(Boolean(a.isNew || a.isBridalPreview));
      case "price-asc":
        return a.price - b.price;
      case "price-desc":
        return b.price - a.price;
      case "name":
        return a.name.localeCompare(b.name);
      case "featured":
      default:
        return products.findIndex((product) => product.id === a.id) - products.findIndex((product) => product.id === b.id);
    }
  });

  const limit = filters.limit ?? 24;
  const offset = filters.offset ?? 0;

  return {
    items: sorted.slice(offset, offset + limit),
    meta: {
      total: sorted.length,
      limit,
      offset,
      categories: uniqueSorted(products.map((product) => product.category)),
      colors: uniqueSorted(products.flatMap((product) => product.colors)),
      materials: uniqueSorted(products.map((product) => product.material)),
      occasions: uniqueSorted(products.flatMap((product) => product.occasion)),
      tags: uniqueSorted(products.flatMap((product) => product.tags ?? [
        ...(product.isNew ? ["New arrival"] : []),
        ...(product.isBridalPreview ? ["Bridal preview"] : []),
      ])),
    },
  };
}

export async function listProducts(filters: ProductFilters): Promise<{ items: Product[]; meta: ProductListMeta }> {
  if (hasDatabase()) {
    return listProductsFromDatabase(filters);
  }

  return listProductsFromFallback(filters);
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  if (hasDatabase()) {
    return getProductBySlugFromDatabase(slug);
  }

  return products.find((product) => product.slug === slug);
}

export async function getProductById(id: string): Promise<Product | undefined> {
  if (hasDatabase()) {
    return getProductByIdFromDatabase(id);
  }

  return products.find((product) => product.id === id);
}

export async function listCollections() {
  if (hasDatabase()) {
    return listCollectionsFromDatabase();
  }

  return collections;
}
