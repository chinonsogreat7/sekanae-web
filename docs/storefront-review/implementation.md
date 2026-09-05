# Storefront fixes — 2026-09-05

Implemented the homepage/shop fixes from the review while retaining the existing visual identity.

- Confirmed the API returned eight products, but omitted the CORS allow-origin header for `http://127.0.0.1:5173`. Local Vite development and preview now proxy `/api` to port 4000. Explicit `VITE_API_URL` and deployed-host behavior retain precedence.
- Reused live catalog photography for the homepage hero and category links. Categories without catalog products are omitted from that row. The prior landscape/gift-box tiles are replaced by relevant catalog categories.
- Product images try only other images assigned to the same item, then show an honest unavailable message. Removed the unrelated clothing-photo fallback from cards and product detail galleries.
- Introduced distinct loading, failed-request, empty-catalog, and no-filter-matches states. Homepage New Arrivals no longer silently disappears when the catalog is unavailable. Retry clears stale error feedback.
- Reduced the shop banner and result-count prominence. Added more legible homepage button and product-label text, two-column mobile category/arrival grids, and shopping actions above the mobile hero image.
- Shortened storefront interaction motion, gave dropdowns a top origin, added press feedback, and suppressed hover transforms on touch devices. Existing reduced-motion overrides remain in effect.

Validation: live browser catalog load, desktop and mobile screenshots, zero-match search and recovery, keyboard category selection, quick-view Escape and focus return. `npm run test:storefront` passes four regression tests; the API suite passes 28 with four database integration tests skipped. Typecheck, lint, frontend build, and API build pass. Vite retains its pre-existing large-bundle advisory.

No production deployment or catalog/database edits. Existing catalog demo photos remain; real product photography can be supplied through the admin catalog.
