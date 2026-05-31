import { getPool } from "../db/pool.js";

type WishlistRow = {
  product_id: string;
};

export async function listCustomerWishlistFromDatabase(email: string): Promise<string[]> {
  const pool = getPool();
  const result = await pool.query<WishlistRow>(
    `
      select cw.product_id
      from customer_wishlist cw
      join products p on p.id = cw.product_id
      where lower(cw.email) = lower($1)
        and p.active = true
      order by cw.created_at desc
    `,
    [email],
  );

  return result.rows.map((row) => row.product_id);
}

export async function replaceCustomerWishlistInDatabase(email: string, productIds: string[]): Promise<string[]> {
  const pool = getPool();
  const client = await pool.connect();
  const uniqueProductIds = [...new Set(productIds)];

  try {
    await client.query("begin");
    await client.query("delete from customer_wishlist where lower(email) = lower($1)", [email]);

    if (uniqueProductIds.length) {
      await client.query(
        `
          insert into customer_wishlist (email, product_id)
          select lower($1), p.id
          from products p
          join unnest($2::text[]) as input(product_id) on input.product_id = p.id
          where p.active = true
          on conflict do nothing
        `,
        [email, uniqueProductIds],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return listCustomerWishlistFromDatabase(email);
}
