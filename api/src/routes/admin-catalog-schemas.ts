import { z } from "zod";

export const productBodySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  collection: z.string().min(1),
  price: z.number().min(0),
  colors: z.array(z.string().min(1)).min(1),
  material: z.string().min(1),
  occasion: z.array(z.string().min(1)).min(1),
  images: z.array(z.string().url()).min(1),
  description: z.string().min(1),
  details: z.object({
    materials: z.string().min(1),
    dimensions: z.string().min(1),
    care: z.string().min(1),
    shipping: z.string().min(1),
  }),
  rating: z.number().min(0).max(5).default(0),
  reviews: z.number().int().min(0).default(0),
  stock: z.number().int().min(0).default(0),
  tags: z.array(z.string().min(1)).default([]),
  isNew: z.boolean().optional(),
  isBridalPreview: z.boolean().optional(),
  status: z.enum(["draft", "published"]).default("published"),
});

// CSV imports need only name, category, price, stock and an explicit status.
// Missing merchandising facts stay empty rather than becoming invented copy.
export const productImportBodySchema = productBodySchema.extend({
  price: z.number().finite().min(0).max(21474836.47).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, "Price must have at most two decimal places."),
  stock: z.number().int().min(0).max(2147483647),
  status: z.enum(["draft", "published"]),
  colors: z.array(z.string().min(1)).default([]),
  material: z.string().default(""),
  occasion: z.array(z.string().min(1)).default([]),
  images: z.array(z.string().url()).default([]),
  details: z.object({
    materials: z.string().default(""),
    dimensions: z.string().default(""),
    care: z.string().default(""),
    shipping: z.string().default(""),
  }),
});

export const collectionBodySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  image: z.string().url(),
  cta: z.string().min(1),
  sortOrder: z.number().int().min(0).default(0),
});

export const categoryBodySchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  image: z.string().url().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const inventoryBodySchema = z.object({
  quantity: z.number().int().min(0),
});
