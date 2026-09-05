# Product CSV imports

Open **Admin → Products → Bulk add products**, download the template, and fill **A/name, B/category, D/price, N/stock and T/status**. Prices use EUR; status must be `draft` or `published`. Optional columns can be blank or omitted, but retain the header names for every column you use.

Select the CSV to open the editable review. This does not save products or upload images. Fix any row errors, edit the five required fields or open **Optional details**, and remove unwanted rows. If referencing images, separate exact local file names with `|`, then select the matching image files.

Review the defaults and publishing counts, check the review checkbox, and press **Confirm import**. All remaining rows must be valid. Published rows become visible immediately; draft rows stay in the admin. Existing products cannot be overwritten by this importer. Successful rows are locked; failures stay editable for retry.

Use **Save review for later** to keep edits without importing products. Under **Saved CSV reviews**, press **Resume** to restore rows, edits and import results after navigating away, reloading, or signing in again. Saved reviews belong to the signed-in admin. Local image files must be reselected; their names are preserved in the review.

Final import saves the reviewed values first, then records each row result with a small incremental update. Successful rows remain locked when resumed. If progress cannot be saved, the import pauses; keep the page open and save a new copy to retain the latest result. Stale changes from another tab are rejected rather than overwriting a newer saved review. Review persistence does not itself create products or upload images.

Removing a saved review does not remove products already imported. Unsaved changes can still be lost when leaving or reloading, so save before leaving. Import records are logged individually in Audit. Image uploads require the normal Cloudinary configuration.

Database migration `017_admin_saved_work.sql` is required for saved reviews and saved order views.

Validation:

```sh
node --import tsx --test api/tests/product-csv.test.ts
CSV_TEST_DATABASE_URL=postgresql://USER@127.0.0.1:5432/LOCAL_DATABASE node --import tsx --test api/tests/product-csv.integration.test.ts
```

The integration test requires a migrated local database. It creates a uniquely named product, verifies import/duplicate protection, and removes its own data afterward.
