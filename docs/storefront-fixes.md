# Storefront fixes — September 2026

## Repository configuration

Restored eslint.config.js from the inspected pre-injection revision 817a5f0, retaining generated-output ignores. Commit 83583ca added the suspicious obfuscated remote-code loader. The previous lint attempt failed at parsing before the configuration executed. The payload is removed from this working tree, not from Git history or other checkouts. This is not a forensic assessment of the computer or any earlier executions.

## Shopping changes

- Shared catalog provider across homepage, store/cart and shop, with pagination, request sharing and retry messaging.
- Unknown product slugs no longer substitute an unrelated item. A 404 overrides saved data; service errors retain only a matching saved product.
- Cart and checkout use POST /api/cart/quote for availability, currency, shipping and VAT. Order creation revalidates expectedTotal before persisting, rejecting changed prices with 409.
- Stock validation aggregates quantities across colors/duplicate lines and rejects invalid colors instead of substituting another variant.
- Guest checkout uses the existing guest-order API. Sign-in remains available and account creation is optional after confirmed payment. Marketing opt-in defaults off.
- Removed the nonfunctional promo input and hardcoded product testimonials/rating display. Variant keys and cart control labels now include color.
- Collapsible responsive filters, persistent filter chips, taller search input, smaller product/checkout headings, larger cart controls, and focus management for gallery/quick view.
- Hero uses an existing catalog accessory photo. Removed the unrelated second hoops photo from the bundled catalog. Actual brand photography and verified reviews still need real content; no reviews or product photos were fabricated, and no production database content was edited.

## Verification and deployment

Run npm test, npm run typecheck, npm run lint, npm run build and npm run api:build. The regression suite uses Fastify injection with no database and never charges or emails anyone.

Deploy the API changes with or before the frontend: /api/cart/quote is now required before checkout can proceed. An unavailable quote blocks payment and offers retry without discarding the cart.

Local browser validation uses the sample catalog with no database, email or Stripe credentials. Real order persistence, Stripe payment/confirmation and authenticated account creation require a separately configured test environment. VAT env parsing now respects the literal string false. Production market settings remain unchanged.
