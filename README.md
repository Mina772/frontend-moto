# moto-erp-frontend

Back-office web app (React 18 + Vite) with an in-browser POS at `/pos`. It uses the same `@moto/pos-core` terminal, checkout and invoice templates as `../pos-desktop`, plus the desktop-style toolbar, font scaling, shift opening/closing, idle lock and customer display (`/pos/display`, F7). The POS fills the viewport and provides a button back to the ERP.

Browser sales are saved directly through the API and require connectivity. Carts and held invoices persist per user and branch on the device. Printing uses the browser print dialog. Small/large checkout selects a thermal (58/80mm) or sheet (A5/A4) profile and honors its configured paper. The physical cash drawer and SQLite/outbox sync remain desktop capabilities. Desktop checkout also uses the system printer dialog.
Self-contained project: `@moto/shared`, `@moto/api-client`, `@moto/ui` and `@moto/pos-core` live in `packages/` and are linked through this project's own npm workspace.

```bash
npm install
npm run dev      # http://localhost:5173 — proxies /api, /socket.io, /uploads → :4000
npm run build    # tsc -b && vite build → dist/
npm test         # vitest + testing-library (jsdom)
```

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `/api` | REST base URL |
| `VITE_SOCKET_URL` | `window.location.origin` | Socket.IO origin |
| `VITE_PUBLIC_URL` | `window.location.origin` | Base for the `/v/:invoice` QR link printed on receipts |
| `VITE_API_PROXY` | `http://localhost:4000` | Dev-server proxy target (read from `.env*` via `loadEnv`) |

**Same-origin with the API is the preferred deployment** (reverse proxy `/api`, `/socket.io`, `/uploads` → `api:4000`). `Dockerfile` (build context = this folder) + `nginx/app.conf` do exactly that: a non-root nginx serving the hashed bundle with long-lived asset caching, a CSP, and the three proxied paths. `VITE_*` values are build arguments because Vite inlines them, so changing them means rebuilding the image.

The web service is defined in `docker-compose.yml` as an overlay on the backend stack. Configure
`../erp-backend/.env.docker` from its example, then run `npm run docker:stack -- up -d --build` from
the repository root or `erp-backend`. Backend services and deployment variables live in `erp-backend`.

### Cross-origin deployment (Firebase Hosting + Azure App Service)

Firebase Hosting can only rewrite to Cloud Run/Functions, so `/api` there falls through to the SPA rewrite and the app receives `index.html` where it expects JSON. `.env.production` therefore points `VITE_API_URL` / `VITE_SOCKET_URL` at the API origin, and the API must be configured to match:

- `CORS_ORIGINS` must list the app origin (e.g. `https://moto-parts.web.app`).
- `COOKIE_SAMESITE=none` — the refresh cookie is `httpOnly` and scoped to `/api/auth`; with the default `Lax` the browser never sends it cross-site and every session silently dies after the 15-minute access token expires.
- `PUBLIC_URL` on the API and `VITE_PUBLIC_URL` here both point at the **app** origin (the `/v/:invoice` QR route is a frontend route).

## Features added in v2

| Route | Feature |
|---|---|
| `/products/labels/designer` | Label designer: drag/resize elements (company, name, barcode, price tier, SKU, logo, custom text), presets 50×25 / 40×30 / 58×40, exact-mm print |
| `/products/barcodes` | Batch label printing with the system barcode |
| `/pos` | Three-tier pricing (1/2/3 keys, per-line tier popover, special prices), quick grid, print profiles, alternatives suggester, QR on receipt |
| `/settings` → Printing | Print profiles (thermal 58/80, A4, A5 · compact/detailed), per-device default — every paper renders the same branded invoice design |
| `/reports/dead-stock` | Idle-days filter, frozen capital, carrying cost, suggested actions (discount / transfer / liquidate / return to supplier) |
| `/alerts` | Alerts center + top notification bar (low/dead stock, overdue debts, register discrepancies, failed syncs) |
| `/v/:invoiceNumber` | Public invoice verification (QR target; resolves offline-generated numbers once synced) |

## Layout

```
src/
  features/<domain>/   pages + dialogs per module
  services/            thin wrappers over @moto/api-client (singleton in services/api.ts)
  stores/              zustand: auth (persisted), ui (locale/theme/branch)
  lib/realtime.tsx     Socket.IO → TanStack Query invalidation
  i18n/                ar.ts / en.ts — Arabic is the source of truth; `tx()` falls back ar→en
  components/          ui primitives, shared tables/forms/charts, layout
```

Product names are Arabic-required with optional English; everything in the UI renders via `tx()` so missing English never breaks a screen.
