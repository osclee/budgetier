# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A private, single-user budgeting web app that reproduces a personal Google-Sheet workflow: a
transactions ledger and a monthly Balances view showing Planned vs Actual vs Diff per category,
with computed summary rows (Net Disposable, Remaining, Discretionary). Single-user only — auth
exists to keep the deployed app private, not to support multiple accounts.

Stack: Vue 3 + Vite + TypeScript + Pinia + Tailwind v4 (`frontend/`), Azure Functions v4 on
Node 20 + TypeScript (`api/`), Azure Cosmos DB for NoSQL, hosted on Azure Static Web Apps.

## Commands

Run from repo root unless noted.

```bash
# Install everything
npm run install:all

# Local dev — two terminals (preferred over the SWA emulator; simpler, no strict CSP during HMR)
cd api && npm start          # tsc build then `func start` on http://localhost:7071
cd frontend && npm run dev   # Vite dev server on http://localhost:5173, proxies /api -> :7071

# All-in-one via SWA CLI emulator (root)
npm run dev                  # runs `swa start`

# Build both packages
npm run build

# Seed Cosmos DB (creates containers, user, default categories) — run after configuring api/local.settings.json
npm run seed --prefix api
npm run seed:test-data --prefix api   # extra fixture data for local testing

# Frontend only
cd frontend && npm run build   # vue-tsc -b (type-check) && vite build
cd frontend && npm run preview

# API only
cd api && npm run build   # tsc
cd api && npm run watch   # tsc -w
```

There is no unit test runner (no Jest/Vitest) configured. Pure business logic is validated via
ad hoc fixture scripts instead:

```bash
cd api && npx tsc && node dist/scripts/test-balances.js
cd api && npx tsc && node dist/scripts/test-insights.js
```

When changing `balances-compute.ts` or `insights-compute.ts`, run the matching script above.

Before local dev, copy `api/local.settings.json.example` → `api/local.settings.json` and fill
in real Cosmos/JWT values. Per the README: use the **same** free-tier Cosmos account for dev
and prod, pointed at a different `COSMOS_DATABASE` (e.g. `budgetier-dev`) — never a second
Cosmos account, which loses the free tier.

## Architecture

### API (`api/src`)

- `functions/*.ts` — one file per resource (`transactions`, `budgets`, `categories`, `recurring`,
  `balances`, `insights`, `auth`). Each registers its routes via `app.http(...)` at the bottom of
  the file and wraps handlers with `withAuth`/`withErrors` from `lib/http.ts`.
- `lib/http.ts` — `withAuth` enforces the JWT cookie and converts thrown `ZodError`s into 400s
  and anything else into a generic 500 (never leaks internals). `withErrors` is the same error
  handling for the unauthenticated login route.
- `lib/auth.ts` — JWT signing/verification and the httpOnly cookie (`budgetier_token`,
  `sameSite: Strict`, 7-day TTL). `INSECURE_COOKIES=true` (local dev only) drops the `secure`
  flag so the cookie survives plain `http://localhost`.
- `lib/cosmos.ts` — lazily-constructed singleton `CosmosClient` (env vars are read inside the
  function, not at module load, because `scripts/seed.ts` populates `process.env` *after*
  importing this module). `CONTAINERS` defines the five containers and their partition keys —
  notably `transactions` and `budgets` are partitioned by `/yearMonth`, not `/id`. All five
  containers share one 400 RU/s database-level throughput (Cosmos free-tier budget).
- `lib/validate.ts` — Zod schemas for request bodies/params, plus `yearMonthOf`/`yearMonthSchema`
  helpers used to derive the partition key from a transaction's date.
- `lib/balances-compute.ts` / `lib/insights-compute.ts` — pure, I/O-free calculation functions
  deliberately kept separate from the Cosmos-querying function handlers so they can be exercised
  by the `scripts/test-*.ts` fixture scripts. **This is the core domain logic of the app** — it
  reproduces the original spreadsheet's math:
  - `Net Disposable = Σ income − Σ deduction`
  - `Remaining = Net Disposable − Σ need − Σ investment`
  - `Discretionary (planned) = Remaining − Σ giving − Σ savings` (a plug value)
  - `Discretionary (actual) = Σ actual discretionary transactions`
  - `Unallocated = Remaining − Σ giving − Σ savings − Discretionary(actual)`
  - Categories carry a `kind` (`income`/`deduction`/`need`/`investment`/`giving`/`savings`/
    `discretionary`) that drives which bucket they're summed into.
- Moving a transaction to a different month (`update` in `functions/transactions.ts`) changes its
  partition key, so Cosmos can't do an in-place replace — it's a delete + recreate.

### Frontend (`frontend/src`)

- `lib/api.ts` — thin `fetch` wrapper. Always calls same-origin `/api/...` with
  `credentials: "include"` so the httpOnly auth cookie is sent; Vite's dev proxy (`vite.config.ts`)
  forwards `/api` to the Functions host on `:7071` so this works identically in dev and prod.
- `stores/` (Pinia) — one store per resource, mirroring the API's resource split
  (`auth`, `budgets`, `categories`, `recurring`, `transactions`, `ui`).
- `router/index.ts` — a `beforeEach` guard calls `auth.checkSession()` once (`auth.ready`) and
  redirects unauthenticated users to `/login` (except routes marked `meta: { guest: true }`).
  All authenticated views are nested under `AppLayout.vue`.
- Views map 1:1 to the main sections: `TransactionsView`, `BalancesView`, `CategoriesView`,
  `RecurringView`, `InsightsView`, `LoginView`.

### Hosting / config

- `staticwebapp.config.json` — SPA fallback rewrite, security headers (CSP, HSTS, etc.), and
  `node:20` API runtime. Keep the CSP in sync if adding new external script/style/connect
  sources.
- `swa-cli.config.json` — SWA CLI emulator config used by the root `npm run dev`.
- Deployment is via a single auto-generated GitHub Actions workflow
  (`.github/workflows/azure-static-web-apps.yml`); see [AZURE_SETUP.md](AZURE_SETUP.md) for the
  full walkthrough.
