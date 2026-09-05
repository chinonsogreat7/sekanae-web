# Editorial emails

Editorial is the selected SEKANAE email direction: an espresso masthead, serif headlines, warm paper sections, and catalog photography when available.

## Implementation

- `api/src/emails/editorial.ts` contains the shared frame, typography, buttons, product presentation, and escaping helpers.
- `api/src/emails/templates.ts` builds customer/admin orders, account codes, newsletters, and cart reminders. Concierge notifications use the same frame through `baseEmailHtml`.
- Existing services retain their sending, audience, unsubscribe-token, and delivery-event behavior.

Order emails display saved order amounts, including promo discounts and inclusive/exclusive VAT. Image lookup matches the actual product ID; missing or unavailable images leave the saved item text intact. Saved-cart product names retain their product links. Sign-in emails use the configured code expiry.

Dynamic text is escaped and generated image/link URLs accept HTTP(S) only. Newsletter bodies remain trusted HTML from the existing admin editor; headings, preview text, and subscriber details are escaped separately.

## Local previews

Run from the repository root:

```sh
node --import tsx api/scripts/preview-emails.ts
```

With Vite running, open `/email-template-previews.html`. It contains 11 samples rendered by the production template builders, desktop/mobile controls, and HTML downloads. Samples live in `docs/email-preview/`; edit the builders and regenerate instead of editing generated HTML. The gallery source is `scripts/email-preview-shell.html`.

Rendering uses fictional customer data and existing demo catalog photography. It does not contact a database or send messages. The earlier three-option order-confirmation prototype has been retired.

## Verification

```sh
node --import tsx --test api/tests/email-templates.test.ts
npm run lint
npm run api:build
```

Templates use tables, inline styles, fallback system fonts, responsive overrides, and an Outlook width wrapper. Desktop and narrow browser previews have been checked. Actual Gmail, Apple Mail, Outlook, and dark-mode inbox rendering still need delivery tests before deployment; browser previews cannot establish that compatibility. No production deployment or live email sends were performed for this change.
