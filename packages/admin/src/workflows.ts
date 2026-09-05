import { z } from "zod";

export const lowStockThreshold = 5;
export const orderStatuses = ["pending", "paid", "processing", "fulfilled", "cancelled", "refunded"] as const;
export const paymentStatuses = ["unpaid", "requires_action", "paid", "failed", "refunded"] as const;
const date = z.string().refine((value) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value), "Choose a valid date.");
export const orderFiltersSchema = z.object({
  q: z.string().trim().max(200).default(""),
  email: z.union([z.literal(""), z.string().trim().email()]).default(""),
  status: z.enum(["", ...orderStatuses]).default(""),
  paymentStatus: z.enum(["", ...paymentStatuses]).default(""),
  from: date.default(""), to: date.default(""),
}).refine((value) => !value.from || !value.to || value.from <= value.to, { message: "From date must be on or before To date.", path: ["to"] });
export type OrderFilters = z.infer<typeof orderFiltersSchema>;
export const emptyOrderFilters: OrderFilters = { q: "", email: "", status: "", paymentStatus: "", from: "", to: "" };
export const productCsvColumns = [
  "name", "category", "collection", "price", "colors", "material", "occasion", "imageFiles", "description",
  "detailsMaterials", "detailsDimensions", "detailsCare", "detailsShipping", "stock", "rating", "reviews", "tags", "isNew", "isBridalPreview", "status",
] as const;
const csvValuesSchema = z.object(Object.fromEntries(productCsvColumns.map((key) => [key, z.string().max(20000)])) as Record<typeof productCsvColumns[number], z.ZodString>);
export const csvReviewSchema = z.object({
  filename: z.string().min(1).max(255),
  rows: z.array(z.object({
    rowNumber: z.number().int().min(2), values: csvValuesSchema,
    imported: z.boolean().optional(), importError: z.string().max(2000).optional(),
  })).min(1).max(1000).refine((rows) => new Set(rows.map((row) => row.rowNumber)).size === rows.length, "Row numbers must be unique."),
});
export type CsvReview = z.infer<typeof csvReviewSchema>;
export const savedWorkSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("order_view"), name: z.string().trim().min(1).max(100), payload: orderFiltersSchema }),
  z.object({ kind: z.literal("csv_review"), name: z.string().trim().min(1).max(100), payload: csvReviewSchema }),
]);
export type SavedWorkInput = z.infer<typeof savedWorkSchema>;
export type SavedWork = SavedWorkInput & { id: string; revision: number; updatedAt: string };
export type SavedWorkSummary = Pick<SavedWork, "id" | "kind" | "name" | "revision" | "updatedAt">;
export type AdminRequest = <T>(path: string, options?: RequestInit) => Promise<{ data: T; meta?: { total?: number } }>;
