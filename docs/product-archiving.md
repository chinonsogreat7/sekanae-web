# Product archiving

The admin Archive action sends `DELETE /api/admin/products/:id`. This is a soft delete: the product row is retained with `active = false`, preserving inventory and historical order references. The admin list excludes inactive products; the storefront additionally excludes drafts. Archived product URLs return 404, inventory edits return 404, and cart validation rejects archived products. A stale product save returns 409 rather than restoring the record. There is currently no restore screen.

After a successful single or bulk archive, admin removes the product locally before refreshing. Failed reads no longer substitute the bundled sample catalog. Older in-flight admin reads cannot replace newer archive results. The storefront revalidates on route changes, tab focus and visibility, and receives archive notifications within the same tab and across tabs on the same origin. Shop previews and the Bridal page use the live catalog. Customers on other devices see changes when their catalog next refreshes.

Startup seeding inserts missing products and collections only. It preserves existing archive flags, admin edits, stock, images and tags. If an earlier deployment already reactivated an archived record, deploy this fix and archive that product again; this change does not infer archive intent from historical audit logs.

## Regression checks

Run `npm run typecheck`, `npm run lint`, and `npm test`.

The database integration suite must use a **fresh disposable PostgreSQL database**, never production: it archives sample products and changes test inventory. Migrate that database, then run:

```sh
DATABASE_URL="$ARCHIVE_TEST_DATABASE_URL" node --import tsx api/scripts/migrate.ts
node --import tsx --test api/tests/archiving.integration.test.ts
```

Set `ARCHIVE_TEST_DATABASE_URL` to the disposable connection URL before running these commands. The suite checks authorization, admin and public lists, product URLs, cart availability, inventory writes, repeated archive requests, stale saves, batch archives and repeated startup migrations/seeding. Without this variable it skips database tests.

Browser checks: open admin and Shop in separate tabs against the test database; archive a product and verify it disappears from both, including an open quick view. Test bulk archive and Bridal previews, then refresh the archived product's URL. Simulate API failure and verify sample products do not reappear.
