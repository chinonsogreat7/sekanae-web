import { closePool, getPool } from "../src/db/pool.js";
import { collections, products } from "../../packages/catalog/src/index.js";

async function seedCatalog() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    for (const [index, collection] of collections.entries()) {
      await client.query(
        `
          insert into collections (id, title, description, image_url, cta, sort_order, active)
          values ($1, $2, $3, $4, $5, $6, true)
          on conflict (id) do nothing
        `,
        [collection.id, collection.title, collection.description, collection.image, collection.cta, index],
      );
    }

    for (const product of products) {
      const inserted = await client.query(
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
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true)
          on conflict (id) do nothing
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
          Boolean(product.isNew),
          Boolean(product.isBridalPreview),
        ],
      );

      // Seeding runs on startup. Existing records belong to the admin, including
      // their archived state, images, tags and current inventory.
      if (!inserted.rowCount) continue;

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
            on conflict (product_id, color) do update set sort_order = excluded.sort_order
          `,
          [product.id, color, index],
        );
      }

      for (const [index, occasion] of product.occasion.entries()) {
        await client.query(
          `
            insert into product_occasions (product_id, occasion, sort_order)
            values ($1, $2, $3)
            on conflict (product_id, occasion) do update set sort_order = excluded.sort_order
          `,
          [product.id, occasion, index],
        );
      }

      const productTags = product.tags ?? [
        ...(product.isNew ? ["New arrival"] : []),
        ...(product.isBridalPreview ? ["Bridal preview"] : []),
      ];

      for (const [index, tag] of productTags.entries()) {
        await client.query(
          `
            insert into product_tags (product_id, tag, sort_order)
            values ($1, $2, $3)
            on conflict (product_id, tag) do update set sort_order = excluded.sort_order
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
    }

    await client.query("commit");
    console.log("Catalog seed complete; existing products and collections preserved.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

try {
  await seedCatalog();
} finally {
  await closePool();
}
