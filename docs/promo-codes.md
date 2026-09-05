# Promo codes

Run `npm run db:migrate` with the API's `DATABASE_URL`, then restart the API. Migration `016_promo_codes.sql` adds the promo table and saved discount fields on orders; it can be run repeatedly by the existing migration script.

In **Admin → Settings → Promo codes**, create a code and enter a percentage from 0.01 to 100. Optional controls set a minimum merchandise subtotal in EUR and an expiry in the admin's local time. Edit an existing code to change its offer or uncheck **Enabled** to disable it. Codes are unique, case-insensitive, and support letters, numbers, hyphens and underscores. Changes appear in the admin audit log.

Customers can apply or remove one code in cart or checkout. The code survives navigation and page refreshes. The API validates the current code, minimum spend and expiry on each quote and when creating an order. Minimum spend converts from EUR using the store exchange rates. Discounts apply to merchandise before calculating VAT; shipping is excluded. Client-supplied discount amounts are ignored. A changed total requires the customer to review and submit again.

Orders retain the applied code and monetary discount. Stripe receives a fixed-amount coupon matching the saved discount, so the payment total matches the reviewed order even if an admin edits the promotion later. Pending orders retain their quoted offer. There are no redemption limits or first-order restrictions. A 100% discount leaves shipping payable when shipping is charged.

## Verification

Unit tests and builds:

```sh
node --import tsx --test api/tests/*.test.ts
npm run lint
npm run typecheck
npm run build
npm run api:build
```

The database integration test is opt-in. Use a disposable PostgreSQL database with migrations and catalog seeds applied, without customized store settings:

```sh
DATABASE_URL="$PROMO_TEST_DATABASE_URL" node --import tsx api/scripts/migrate.ts
DATABASE_URL="$PROMO_TEST_DATABASE_URL" node --import tsx api/scripts/seed-catalog.ts
node --import tsx --test api/tests/*.test.ts
```

Export `PROMO_TEST_DATABASE_URL` before running these commands. The test verifies authenticated administration, duplicate and invalid codes, EUR/USD pricing, VAT modes, order persistence, changed offers, and exact Stripe totals. Stripe is mocked; no payment or external email is sent. Test-created orders, promo codes and audit entries are cleaned up.
