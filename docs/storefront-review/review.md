# Storefront review — 2026-09-05

Scope: current local homepage and shop entry, using the Codex in-app browser. Review only; no storefront code changes.

1. Homepage (`01-home.png`): clear shopping calls to action, consistent serif typography, and visible category navigation. Needs attention: hero image fails to display, leaving most of the opening area blank. New Arrivals has no products or explanatory state during the current catalog failure. Category photography varies in subject, lighting, and relevance (clothing rack for Scarves and landscape for Travel Accessories).
2. Shop (`02-shop.png`): labeled filters and a visible retry action are useful foundations. Currently blocked by catalog loading failure. It simultaneously presents “0 refined pieces,” a collection loading error, and “No pieces match,” wrongly implying that filters caused the empty collection. Give loading, failure, genuinely empty catalog, and zero filtered results distinct presentations. The oversized shop heading and result count compete with the products; shorten the hero and lower result-count prominence.

Recommended order: repair image/catalog presentation first, unify photographic direction and hierarchy second, then refine interaction feedback and transitions. Match the approved Editorial emails with restrained cream, espresso, gold, and serif treatments while preserving the storefront's identity.

Relevant Emil Kowalski skills: `emil-design-eng` for component polish and motion decisions; `prototype` for comparing homepage/collection layouts; `review-animations` for checking existing animation choices. Source: https://github.com/emilkowalski/skills/tree/main

Accessibility notes: filter labels are present in the accessibility tree; small pale gold text warrants measured contrast checks. CSS contains reduced-motion handling. Keyboard/focus behavior, contrast ratios, mobile layout, and live transitions were not comprehensively tested in this review. Product browsing and checkout were not audited because catalog loading failed; the underlying API failure has not been diagnosed.

Email implementation status was independently checked in source: customer/admin orders, account codes, newsletters, cart reminders, and concierge routes use the new Editorial builders/frame. This confirms local integration, not deployment or email-client compatibility.
