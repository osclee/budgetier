# Budgetier

A private, single-user budgeting web app. It reproduces a personal Google-Sheet workflow:
a **transactions ledger** and a monthly **Balances** view showing *Planned* vs *Actual* vs
*Diff* per category, with computed summary rows (Net Disposable, Remaining, Discretionary).

## Stack

| Layer     | Tech |
|-----------|------|
| Frontend  | Vue 3 + Vite + TypeScript, Pinia, Vue Router, Tailwind CSS v4 |
| Backend   | Azure Functions v4 (Node 20 + TypeScript) |
| Database  | Azure Cosmos DB for NoSQL (free tier) |
| Auth      | Username/password → bcrypt + JWT in an httpOnly cookie |
| Hosting   | Azure Static Web Apps (Free SKU) — hosts the app + managed Functions API |
| CI/CD     | GitHub Actions (single auto-generated workflow) |

## Layout

```
budgetier/
├── frontend/   # Vue SPA
├── api/        # Azure Functions HTTP API + Cosmos seed script
├── staticwebapp.config.json
├── swa-cli.config.json
└── AZURE_SETUP.md
```

## Local development

Prereqs: Node 20+, a Cosmos DB account, and [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local)
(`func`) for running the API.

> **Free tier applies per Cosmos *account*, not per database.** One account gets 1000 RU/s +
> 25 GB free forever, but that account can hold multiple *databases*, all sharing the same
> free pool. So use the **same** free-tier account as production, just point local dev at a
> second database inside it — e.g. `COSMOS_DATABASE=budgetier-dev` alongside prod's
> `budgetier` — via the same `COSMOS_ENDPOINT`/`COSMOS_KEY`. Each database's seed run
> provisions 400 RU/s shared throughput, so prod (400) + dev (400) = 800 RU/s, still under
> the 1000 RU/s free ceiling. Do **not** create a second Cosmos account for dev — a second
> account won't get the free tier discount and will incur cost.

```bash
# 1. Install dependencies
npm install --prefix frontend
npm install --prefix api

# 2. Configure API secrets
cp api/local.settings.json.example api/local.settings.json   # then fill in real values

# 3. Seed the database (creates containers, the user, and default categories)
npm run seed --prefix api
```

Then run the two processes (in separate terminals):

```bash
# Terminal A — the Functions API on http://localhost:7071
cd api && npm start          # runs `tsc` then `func start`

# Terminal B — the Vue dev server on http://localhost:5173
cd frontend && npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api/*` to the Functions host, so the browser
stays same-origin and the auth cookie flows — exactly like production.

> Prefer the all-in-one Azure emulator? `swa-cli.config.json` is included, so
> `npm run dev` (root) runs `swa start`. The two-terminal flow above is simpler and avoids
> the emulator's stricter CSP during HMR.

## Deploying to Azure

See [AZURE_SETUP.md](AZURE_SETUP.md) for the full step-by-step walkthrough.

## Scripts (root `package.json`)

- `npm run dev` – start the SWA emulator (frontend + API)
- `npm run build` – build both packages
