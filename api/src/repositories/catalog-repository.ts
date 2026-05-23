import { getPool } from "../db/pool.js";
import type { ProductFilters, ProductListMeta, ProductSort } from "../services/catalog-service.js";
import { categories, colors, materials, occasions, type Collection, type Product } from "../../../packages/catalog/src/index.js";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  category: Product["category"];
  collection: string;
  price_cents: number;
  material: string;
  description: string;
  details_materials: string;
  details_dimensions: string;
  details_care: string;
  details_shipping: string;
  rating: string;
  reviews: number;
  is_new: boolean;
  is_bridal_preview: boolean;
  stock: number;
  images: string[];
  product_colors: string[];
  product_occasions: string[];
};

type CollectionRow = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  cta: string;
};

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    collection: row.collection,
    price: row.price_cents / 100,
    colors: row.product_colors,
    material: row.material,
    occasion: row.product_occasions,
    images: row.images,
    description: row.description,
    details: {
      materials: row.details_materials,
      dimensions: row.details_dimensions,
      care: row.details_care,
      shipping: row.details_shipping,
    },
    rating: Number(row.rating),
    reviews: row.reviews,
    stock: row.stock,
    isNew: row.is_new || undefined,
    isBridalPreview: row.is_bridal_preview || undefined,
  };
}

function mapCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    image: row.image_url,
    cta: row.cta,
  };
}

function sortSql(sort: ProductSort | undefined) {
  switch (sort) {
    case "new":
      return "p.is_new desc, p.is_bridal_preview desc, p.created_at desc";
    case "price-asc":
      return "p.price_cents asc, p.name asc";
    case "price-desc":
      return "p.price_cents desc, p.name asc";
    case "name":
      return "p.name asc";
    case "featured":
    default:
      return "p.created_at asc";
  }
}

function buildProductWhere(filters: ProductFilters) {
  const values: Array<string | number> = [];
  const where = ["p.active = true"];

  if (filters.category) {
    values.push(filters.category);
    where.push(`p.category = $${values.length}`);
  }

  if (filters.collection) {
    values.push(filters.collection);
    where.push(`p.collection = $${values.length}`);
  }

  if (filters.color) {
    values.push(filters.color);
    where.push(`exists (select 1 from product_colors pc_filter where pc_filter.product_id = p.id and pc_filter.color = $${values.length})`);
  }

  if (filters.material) {
    values.push(filters.material);
    where.push(`p.material = $${values.length}`);
  }

  if (filters.occasion) {
    values.push(filters.occasion);
    where.push(`exists (select 1 from product_occasions po_filter where po_filter.product_id = p.id and po_filter.occasion = $${values.length})`);
  }

  if (filters.q?.trim()) {
    values.push(`%${filters.q.trim()}%`);
    where.push(`(p.name ilike $${values.length} or p.description ilike $${values.length} or p.category ilike $${values.length} or p.collection ilike $${values.length})`);
  }

  return { whereSql: where.join(" and "), values };
}

export async function listProductsFromDatabase(filters: ProductFilters): Promise<{ items: Product[]; meta: ProductListMeta }> {
  const pool = getPool();
  const { whereSql, values } = buildProductWhere(filters);
  const limit = filters.limit ?? 24;
  const offset = filters.offset ?? 0;

  const countResult = await pool.query<{ total: string }>(
    `select count(*)::text as total from products p where ${whereSql}`,
    values,
  );

  const productResult = await pool.query<ProductRow>(
    `
      select
        p.*,
        coalesce(i.quantity, 0) as stock,
        coalesce(
          (select array_agg(pi.url order by pi.sort_order) from product_images pi where pi.product_id = p.id),
          '{}'::text[]
        ) as images,
        coalesce(
          (select array_agg(pc.color order by pc.sort_order) from product_colors pc where pc.product_id = p.id),
          '{}'::text[]
        ) as product_colors,
        coalesce(
          (select array_agg(po.occasion order by po.sort_order) from product_occasions po where po.product_id = p.id),
          '{}'::text[]
        ) as product_occasions
      from products p
      left join inventory i on i.product_id = p.id
      where ${whereSql}
      order by ${sortSql(filters.sort)}
      limit $${values.length + 1}
      offset $${values.length + 2}
    `,
    [...values, limit, offset],
  );

  return {
    items: productResult.rows.map(mapProduct),
    meta: {
      total: Number(countResult.rows[0]?.total ?? 0),
      limit,
      offset,
      categories,
      colors,
      materials,
      occasions,
    },
  };
}

export async function getProductBySlugFromDatabase(slug: string): Promise<Product | undefined> {
  const pool = getPool();
  const result = await pool.query<ProductRow>(
    `
      select
        p.*,
        coalesce(i.quantity, 0) as stock,
        coalesce((select array_agg(pi.url order by pi.sort_order) from product_images pi where pi.product_id = p.id), '{}'::text[]) as images,
        coalesce((select array_agg(pc.color order by pc.sort_order) from product_colors pc where pc.product_id = p.id), '{}'::text[]) as product_colors,
        coalesce((select array_agg(po.occasion order by po.sort_order) from product_occasions po where po.product_id = p.id), '{}'::text[]) as product_occasions
      from products p
      left join inventory i on i.product_id = p.id
      where p.active = true and p.slug = $1
      limit 1
    `,
    [slug],
  );

  return result.rows[0] ? mapProduct(result.rows[0]) : undefined;
}

export async function getProductByIdFromDatabase(id: string): Promise<Product | undefined> {
  const pool = getPool();
  const result = await pool.query<ProductRow>(
    `
      select
        p.*,
        coalesce(i.quantity, 0) as stock,
        coalesce((select array_agg(pi.url order by pi.sort_order) from product_images pi where pi.product_id = p.id), '{}'::text[]) as images,
        coalesce((select array_agg(pc.color order by pc.sort_order) from product_colors pc where pc.product_id = p.id), '{}'::text[]) as product_colors,
        coalesce((select array_agg(po.occasion order by po.sort_order) from product_occasions po where po.product_id = p.id), '{}'::text[]) as product_occasions
      from products p
      left join inventory i on i.product_id = p.id
      where p.active = true and p.id = $1
      limit 1
    `,
    [id],
  );

  return result.rows[0] ? mapProduct(result.rows[0]) : undefined;
}

export async function listCollectionsFromDatabase(): Promise<Collection[]> {
  const pool = getPool();
  const result = await pool.query<CollectionRow>(
    `
      select id, title, description, image_url, cta
      from collections
      where active = true
      order by sort_order asc, title asc
    `,
  );

  return result.rows.map(mapCollection);
}
