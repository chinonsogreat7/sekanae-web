# Product archiving

The admin Archive action sends `DELETE /api/admin/products/:id`. This is a soft delete: the product row is retained with `active = false`, preserving inventory and historical order references. The default admin list excludes inactive products; **Products → Archived products** provides a searchable archive with an **Unarchive** action. The storefront additionally excludes drafts. Archived product URLs return 404, inventory edits return 404, and cart validation rejects archived products. A stale product save returns 409 rather than restoring the record. Unarchive calls the authenticated `POST /api/admin/products/:id/restore` endpoint. It changes only the active flag and update timestamp, preserving publication status, stock, images and all other saved product fields. Published products become visible again; drafts remain drafts.

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

## Collections

Under **Collections → Archived collections**, search retained collections and select **Unarchive**. `GET /api/admin/collections?archived=true` lists them and `POST /api/admin/collections/:id/restore` restores them without changing their contents or sort order. Restoring a collection does not restore its independently archived products. Stale collection saves cannot silently unarchive it.

Both restore endpoints require admin authorization, record a `restore` audit event, and return 404 for nonexistent or already active records. No database migration is needed. Archived records created before this change remain restorable. Use `archived=true` on `GET /api/admin/products` to access archived products; omitting it or using `false` returns active items. Public endpoints never expose archived records through this parameter.

The homepage collection links and Collections page now read the live collection API and refresh on navigation, focus, visibility, and same-origin admin notifications.

Run the restoration integration suite against a disposable migrated local database:

```sh
RESTORE_TEST_DATABASE_URL=postgresql://USER@127.0.0.1:5432/DISPOSABLE_DATABASE node --import tsx --test api/tests/restoring.integration.test.ts
```

This suite creates uniquely named test products and a collection, verifies archive/restore, authorization, draft visibility, unchanged saved data, and audit records. It leaves these records in the disposable database for inspection.
