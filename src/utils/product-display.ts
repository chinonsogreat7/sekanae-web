import type { Product } from "../data/catalog";

export function getProductTags(product: Product) {
  const tags = product.tags ?? [];
  return tags.length ? tags : [
    ...(product.isNew ? ["New"] : []),
    ...(product.isBridalPreview ? ["Bridal Preview"] : []),
  ];
}

export function getSwatchStyle(color: string) {
  return color.startsWith("#") ? { background: color } : undefined;
}

export function getSwatchClassName(color: string) {
  return color.startsWith("#") ? "swatch" : `swatch swatch-${color.toLowerCase().replaceAll(" ", "-")}`;
}
