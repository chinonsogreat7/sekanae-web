import type { Collection, Product } from "../../../packages/catalog/src/index.js";
import { getPool } from "../db/pool.js";
import {
  getProductByIdFromDatabase,
  listCollectionsFromDatabase,
} from "./catalog-repository.js";

type ProductWrite = Product;

type CollectionWrite = Collection & {
  sortOrder?: number;
};

export async function upsertProductInDatabase(product: ProductWrite): Promise<Product> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    await client.query(
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
          active
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
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
          active = excluded.active,
          updated_at = now()
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
        Boolean(product.isNew),
        Boolean(product.isBridalPreview),
        true,
      ],
    );

    await client.query("delete from product_images where product_id = $1", [product.id]);
    await client.query("delete from product_colors where product_id = $1", [product.id]);
    await client.query("delete from product_occasions where product_id = $1", [product.id]);

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
    throw error;
  } finally {
    client.release();
  }

  const savedProduct = await getProductByIdFromDatabase(product.id);

  if (!savedProduct) {
    throw new Error("Product was saved but could not be read back.");
  }

  return savedProduct;
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

  return getProductByIdFromDatabase(productId);
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

  await pool.query(
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
