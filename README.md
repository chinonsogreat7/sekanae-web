# sekanae-web

Sekanae ecommerce storefront built with React, TypeScript, and Vite.

## Scripts

- `npm run dev` starts the local development server.
- `npm run build` creates a production build.
- `npm run preview` serves the production build locally.

## Local storefront and API

Run `npm run api:dev` and `npm run dev` in separate terminals. The local PostgreSQL connection and API settings are read from the ignored `.env.local`. The API listens on port 4000. Vite proxies `/api` to `http://127.0.0.1:4000`, so either `http://localhost:5173` or `http://127.0.0.1:5173` works without cross-origin configuration. The same proxy is available with `npm run preview`.

An explicit `VITE_API_URL` takes precedence (for example, the deployed API in production). Leave it unset when using the local proxy. Production hosting and API origins are unchanged.
