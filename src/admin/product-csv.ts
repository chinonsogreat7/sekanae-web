import type { Product } from "../data/catalog";

// Keep this order stable: spreadsheet columns A, B, D, N and T are required.
export { productCsvColumns } from "../../packages/admin/src/workflows";
import { productCsvColumns } from "../../packages/admin/src/workflows";
export type ProductCsvColumn = typeof productCsvColumns[number];
export const requiredProductCsvColumns = ["name", "category", "price", "stock", "status"] as const;
export type ProductCsvValues = Record<ProductCsvColumn, string>;
export type ProductCsvRow = {
  rowNumber: number;
  values: ProductCsvValues;
  importError?: string;
  imported?: boolean;
};
export const productCsvLabels: Record<ProductCsvColumn, string> = {
  name: "Name (A)", category: "Category (B)", collection: "Collection", price: "Price in EUR (D)",
  colors: "Colors", material: "Material", occasion: "Occasions", imageFiles: "Image file names",
  description: "Description", detailsMaterials: "Materials details", detailsDimensions: "Dimensions",
  detailsCare: "Care instructions", detailsShipping: "Shipping details", stock: "Stock (N)",
  rating: "Rating", reviews: "Review count", tags: "Tags", isNew: "New arrival",
  isBridalPreview: "Bridal preview", status: "Status (T)",
};

export function productCsvSlug(name: string) {
  return name.trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
export function splitImageFiles(value: string) {
  return value.split("|").map((part) => part.trim()).filter(Boolean);
}
function splitList(value: string) {
  return value.split(/[,\n|]/).map((part) => part.trim()).filter(Boolean);
}
function booleanValue(value: string) {
  return /^(true|yes|1|y)$/i.test(value.trim());
}

function parseCsv(text: string) {
  const rows: { cells: string[]; line: number }[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;
  let line = 1;
  let rowLine = 1;
  const finishCell = () => { cells.push(cell.trim()); cell = ""; closedQuote = false; };
  const finishRow = () => {
    finishCell();
    if (cells.some(Boolean)) rows.push({ cells, line: rowLine });
    cells = [];
  };
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') { cell += '"'; index += 1; }
        else { quoted = false; closedQuote = true; }
      } else {
        cell += char;
        if (char === "\n" || (char === "\r" && source[index + 1] !== "\n")) line += 1;
      }
    } else if (char === ",") {
      finishCell();
    } else if (char === "\r" || char === "\n") {
      finishRow();
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      line += 1;
      rowLine = line;
    } else if (char === '"' && !cell.trim() && !closedQuote) {
      cell = "";
      quoted = true;
    } else {
      if (char === '"' || (closedQuote && char.trim())) throw new Error(`Invalid CSV quoting on line ${line}.`);
      cell += char;
    }
  }
  if (quoted) throw new Error(`Unclosed quoted value starting on row ${rowLine}.`);
  finishRow();
  return rows;
}

export function productImportRowsFromCsv(text: string): ProductCsvRow[] {
  const [header, ...data] = parseCsv(text);
  if (!header) throw new Error("Upload a CSV with product headers.");
  const headers = header.cells.map((value) => value.toLowerCase());
  const missing = requiredProductCsvColumns.filter((column) => !headers.includes(column.toLowerCase()));
  if (missing.length) throw new Error(`Missing required CSV columns: ${missing.join(", ")}. Use the template headers.`);
  const namedHeaders = headers.filter(Boolean);
  if (new Set(namedHeaders).size !== namedHeaders.length) throw new Error("CSV column headers must be unique.");
  if (!data.length) throw new Error("The CSV has headers but no product rows.");
  if (data.length > 1000) throw new Error("Import up to 1,000 products at a time. Split this CSV into smaller files.");
  return data.map(({ cells, line }) => {
    if (cells.length !== headers.length) throw new Error(`Row ${line} has ${cells.length} cells; expected ${headers.length}. Quote values containing commas.`);
    const values = Object.fromEntries(productCsvColumns.map((column) => [column, cells[headers.indexOf(column.toLowerCase())] ?? ""])) as ProductCsvValues;
    values.status = values.status.toLowerCase();
    return { rowNumber: line, values };
  });
}

export function productCsvRowErrors(row: ProductCsvRow, rows: ProductCsvRow[], existing: Product[], fileNames: string[]) {
  if (row.imported) return [];
  const { values } = row;
  const errors: string[] = [];
  for (const field of requiredProductCsvColumns) {
    if (!values[field].trim()) errors.push(`${productCsvLabels[field]} is required.`);
  }
  const numericFields = ["price", "stock", "rating", "reviews"] as const;
  for (const field of numericFields) {
    const value = values[field].trim();
    if (!value) continue;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) errors.push(`${productCsvLabels[field]} must be a finite, non-negative number.`);
    else if ((field === "stock" || field === "reviews") && (!Number.isSafeInteger(number) || number > 2147483647)) errors.push(`${productCsvLabels[field]} must be a whole number up to 2,147,483,647.`);
    else if (field === "rating" && number > 5) errors.push("Rating must be between 0 and 5.");
    else if (field === "price" && (!/^\d+(\.\d{1,2})?$/.test(value) || Math.round(number * 100) > 2147483647)) errors.push("Price must be a decimal amount up to 21,474,836.47 with at most two decimal places.");
  }
  if (values.status && !["draft", "published"].includes(values.status)) errors.push("Status (T) must be draft or published.");
  for (const field of ["isNew", "isBridalPreview"] as const) {
    if (values[field] && !/^(true|false|yes|no|1|0|y|n)$/i.test(values[field].trim())) errors.push(`${productCsvLabels[field]} must be true or false.`);
  }
  const slug = productCsvSlug(values.name);
  if (values.name.trim() && !slug) errors.push("Name needs at least one letter A–Z or number to generate a product URL.");
  if (slug && rows.some((other) => other !== row && productCsvSlug(other.values.name) === slug)) errors.push("Another CSV row has the same product name or URL. Rename or remove the duplicate.");
  if (slug && existing.some((product) => product.slug === slug || product.id === `p-${slug}`)) errors.push("This product already exists. Edit it in Products, or use a different name for a new product.");
  for (const name of splitImageFiles(values.imageFiles)) {
    const matches = fileNames.filter((fileName) => fileName === name).length;
    if (!matches) errors.push(`Select the image file “${name}”, or remove its reference.`);
    else if (matches > 1) errors.push(`Multiple selected images are named “${name}”. Select a uniquely named file.`);
  }
  return errors;
}

export function productCsvRowToProduct(row: ProductCsvRow, images: string[] = []): Product {
  const v = row.values;
  const slug = productCsvSlug(v.name);
  const tags = splitList(v.tags);
  return {
    id: `p-${slug}`, slug, name: v.name.trim(), category: v.category.trim(),
    collection: v.collection.trim() || v.category.trim(), price: Number(v.price),
    colors: splitList(v.colors), material: v.material.trim(), occasion: splitList(v.occasion), images,
    description: v.description.trim() || v.name.trim(),
    details: { materials: v.detailsMaterials.trim() || v.material.trim(), dimensions: v.detailsDimensions.trim(), care: v.detailsCare.trim(), shipping: v.detailsShipping.trim() },
    rating: Number(v.rating || 0), reviews: Number(v.reviews || 0), stock: Number(v.stock), tags,
    isNew: booleanValue(v.isNew) || tags.includes("New arrival"),
    isBridalPreview: booleanValue(v.isBridalPreview) || tags.includes("Bridal preview"),
    status: v.status as "draft" | "published",
  };
}

export function productCsvTemplate() {
  const sample: ProductCsvValues = Object.fromEntries(productCsvColumns.map((column) => [column, ""])) as ProductCsvValues;
  Object.assign(sample, { name: "Monde Structured Top Handle", category: "Handbags", price: "640", stock: "12", status: "draft" });
  return `${productCsvColumns.join(",")}\n${productCsvColumns.map((column) => sample[column]).join(",")}\n`;
}
