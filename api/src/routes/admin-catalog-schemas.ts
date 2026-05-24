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
});

export const collectionBodySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  image: z.string().url(),
  cta: z.string().min(1),
  sortOrder: z.number().int().min(0).default(0),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const inventoryBodySchema = z.object({
  quantity: z.number().int().min(0),
});
