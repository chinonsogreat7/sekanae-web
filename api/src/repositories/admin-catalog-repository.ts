import type { Collection, Product } from "../../../packages/catalog/src/index.js";
import { getPool } from "../db/pool.js";
import {
  getProductByIdFromDatabase,
  listAdminProductsFromDatabase,
  listCollectionsFromDatabase,
} from "./catalog-repository.js";

type ProductWrite = Product;

type CollectionWrite = Collection & {
  sortOrder?: number;
};

export type ProductCategoryRecord = {
  id: string;
  name: string;
  image?: string;
  sortOrder: number;
};

type CategoryRow = {
  id: string;
  name: string;
  image_url: string | null;
  sort_order: number;
};

type CategoryWrite = {
  id?: string;
  name: string;
  image?: string;
  sortOrder?: number;
};

function categoryIdFromName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapCategory(row: CategoryRow): ProductCategoryRecord {
  return {
    id: row.id,
    name: row.name,
    image: row.image_url ?? undefined,
    sortOrder: row.sort_order,
  };
}

export async function upsertProductInDatabase(product: ProductWrite, options: { createOnly?: boolean } = {}): Promise<Product> {
  const pool = getPool();
  const client = await pool.connect();
  const tags = product.tags ?? [];
  const isNew = product.isNew || tags.some((tag) => tag.toLowerCase() === "new arrival");
  const isBridalPreview = product.isBridalPreview || tags.some((tag) => tag.toLowerCase() === "bridal preview");
  const status = product.status ?? "published";

  try {
    await client.query("begin");

    await client.query(
      `
        insert into product_categories (id, name, sort_order, active)
        values ($1, $2, 100, true)
        on conflict (id) do update set
          name = excluded.name,
          active = true,
          updated_at = now()
      `,
      [categoryIdFromName(product.category), product.category],
    );

    const saved = await client.query(
      `
        insert into products (
          id,
          slug,
          name,
          category,
          collection,
          price_cents,
          material,
          description,
          details_materials,
          details_dimensions,
          details_care,
          details_shipping,
          rating,
          reviews,
          is_new,
          is_bridal_preview,
          status,
          active
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        on conflict (id) do update set
          slug = excluded.slug,
          name = excluded.name,
          category = excluded.category,
          collection = excluded.collection,
          price_cents = excluded.price_cents,
          material = excluded.material,
          description = excluded.description,
          details_materials = excluded.details_materials,
          details_dimensions = excluded.details_dimensions,
          details_care = excluded.details_care,
          details_shipping = excluded.details_shipping,
          rating = excluded.rating,
          reviews = excluded.reviews,
          is_new = excluded.is_new,
          is_bridal_preview = excluded.is_bridal_preview,
          status = excluded.status,
          active = excluded.active,
          updated_at = now()
        where products.active = true and not $19::boolean
        returning id
      `,
      [
        product.id,
        product.slug,
        product.name,
        product.category,
        product.collection,
        Math.round(product.price * 100),
        product.material,
        product.description,
        product.details.materials,
        product.details.dimensions,
        product.details.care,
        product.details.shipping,
        product.rating,
        product.reviews,
        Boolean(isNew),
        Boolean(isBridalPreview),
        status,
        true,
        Boolean(options.createOnly),
      ],
    );

    if (!saved.rowCount) {
      throw Object.assign(new Error(options.createOnly
        ? "A product with this name already exists. CSV imports cannot overwrite existing products."
        : "This product has been archived. Refresh the product list before making changes."), { statusCode: 409 });
    }

    await client.query("delete from product_images where product_id = $1", [product.id]);
    await client.query("delete from product_colors where product_id = $1", [product.id]);
    await client.query("delete from product_occasions where product_id = $1", [product.id]);
    await client.query("delete from product_tags where product_id = $1", [product.id]);

    for (const [index, image] of product.images.entries()) {
      await client.query(
        `
          insert into product_images (product_id, url, alt, sort_order)
          values ($1, $2, $3, $4)
        `,
        [product.id, image, product.name, index],
      );
    }

    for (const [index, color] of product.colors.entries()) {
      await client.query(
        `
          insert into product_colors (product_id, color, sort_order)
          values ($1, $2, $3)
        `,
        [product.id, color, index],
      );
    }

    for (const [index, occasion] of product.occasion.entries()) {
      await client.query(
        `
          insert into product_occasions (product_id, occasion, sort_order)
          values ($1, $2, $3)
        `,
        [product.id, occasion, index],
      );
    }

    for (const [index, tag] of tags.entries()) {
      await client.query(
        `
          insert into product_tags (product_id, tag, sort_order)
          values ($1, $2, $3)
        `,
        [product.id, tag, index],
      );
    }

    await client.query(
      `
        insert into inventory (product_id, quantity)
        values ($1, $2)
        on conflict (product_id) do update set
          quantity = excluded.quantity,
          updated_at = now()
      `,
      [product.id, product.stock],
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    if (options.createOnly && (error as { code?: string }).code === "23505") {
      throw Object.assign(new Error("A product with this ID or URL already exists. Rename the CSV product before importing."), { statusCode: 409 });
    }
    throw error;
  } finally {
    client.release();
  }

  const savedProduct = await getProductByIdFromDatabase(product.id, { includeDrafts: true });

  if (!savedProduct) {
    throw new Error("Product was saved but could not be read back.");
  }

  return savedProduct;
}

export async function listAdminProducts(archived = false): Promise<Product[]> {
  return listAdminProductsFromDatabase(archived);
}

export async function restoreProductInDatabase(productId: string): Promise<boolean> {
  const result = await getPool().query(
    "update products set active = true, updated_at = now() where id = $1 and active = false",
    [productId],
  );
  return Boolean(result.rowCount);
}

export async function restoreCollectionInDatabase(collectionId: string): Promise<boolean> {
  const result = await getPool().query(
    "update collections set active = true, updated_at = now() where id = $1 and active = false",
    [collectionId],
  );
  return Boolean(result.rowCount);
}

export async function updateInventoryInDatabase(productId: string, quantity: number): Promise<Product | undefined> {
  const pool = getPool();
  const existsResult = await pool.query<{ id: string }>(
    "select id from products where id = $1 and active = true limit 1",
    [productId],
  );

  if (!existsResult.rows[0]) {
    return undefined;
  }

  await pool.query(
    `
      insert into inventory (product_id, quantity)
      values ($1, $2)
      on conflict (product_id) do update set
        quantity = excluded.quantity,
        updated_at = now()
    `,
    [productId, quantity],
  );

  return getProductByIdFromDatabase(productId, { includeDrafts: true });
}

export async function softDeleteProductInDatabase(productId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    "update products set active = false, updated_at = now() where id = $1 and active = true",
    [productId],
  );

  return Boolean(result.rowCount);
}

export async function upsertCollectionInDatabase(collection: CollectionWrite): Promise<Collection> {
  const pool = getPool();

  const saved = await pool.query(
    `
      insert into collections (id, title, description, image_url, cta, sort_order, active)
      values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (id) do update set
        title = excluded.title,
        description = excluded.description,
        image_url = excluded.image_url,
        cta = excluded.cta,
        sort_order = excluded.sort_order,
        active = excluded.active,
        updated_at = now()
      where collections.active = true
      returning id
    `,
    [
      collection.id,
      collection.title,
      collection.description,
      collection.image,
      collection.cta,
      collection.sortOrder ?? 0,
      true,
    ],
  );

  if (!saved.rowCount) {
    throw Object.assign(new Error("This collection has been archived. Unarchive it before making changes."), { statusCode: 409 });
  }

  const savedCollection = (await listCollectionsFromDatabase()).find((item) => item.id === collection.id);

  if (!savedCollection) {
    throw new Error("Collection was saved but could not be read back.");
  }

  return savedCollection;
}

export async function softDeleteCollectionInDatabase(collectionId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    "update collections set active = false, updated_at = now() where id = $1 and active = true",
    [collectionId],
  );

  return Boolean(result.rowCount);
}

export async function listCategoriesInDatabase(): Promise<ProductCategoryRecord[]> {
  const pool = getPool();
  const result = await pool.query<CategoryRow>(
    `
      select id, name, image_url, sort_order
      from product_categories
      where active = true
      order by sort_order asc, name asc
    `,
  );

  return result.rows.map(mapCategory);
}

export async function upsertCategoryInDatabase(category: CategoryWrite): Promise<ProductCategoryRecord> {
  const pool = getPool();
  const categoryName = category.name.trim();
  const categoryId = category.id?.trim() || categoryIdFromName(categoryName);

  const result = await pool.query<CategoryRow>(
    `
      insert into product_categories (id, name, image_url, sort_order, active)
      values ($1, $2, $3, $4, true)
      on conflict (id) do update set
        name = excluded.name,
        image_url = coalesce(excluded.image_url, product_categories.image_url),
        sort_order = excluded.sort_order,
        active = true,
        updated_at = now()
      returning id, name, image_url, sort_order
    `,
    [categoryId, categoryName, category.image ?? null, category.sortOrder ?? 0],
  );

  return mapCategory(result.rows[0]);
}

export async function softDeleteCategoryInDatabase(categoryId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    "update product_categories set active = false, updated_at = now() where id = $1 and active = true",
    [categoryId],
  );

  return Boolean(result.rowCount);
}
