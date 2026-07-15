# Deploying Budgetier to Azure

This is a step-by-step guide to get Budgetier running on Azure for **$0/month** using
**Azure Static Web Apps** (Free plan, hosts the Vue app + the Functions API) and
**Azure Cosmos DB for NoSQL** (free tier).

Everything below is done once. After that, every `git push` to `main` auto-deploys.

---

## 0. Prerequisites

- An **Azure account** (a free account works): https://azure.microsoft.com/free
- A **GitHub account**, and this project pushed to a GitHub repo you own.
- **Node 20+** installed locally (only needed to run the one-time seed script).

Push the code to GitHub first:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<you>/budgetier.git
git push -u origin main
```

---

## 1. Create the Cosmos DB account (free tier)

1. In the [Azure Portal](https://portal.azure.com), click **Create a resource → Azure Cosmos DB**.
2. Choose **Azure Cosmos DB for NoSQL** → **Create**.
3. Fill in:
   - **Resource Group**: create one, e.g. `budgetier-rg`.
   - **Account Name**: e.g. `budgetier-db` (must be globally unique).
   - **Location**: pick one near you.
   - **Capacity mode**: **Provisioned throughput**.
   - **Apply Free Tier Discount**: **Apply**. ⚠️ Important — this is what makes it free
     (first 1000 RU/s + 25 GB are free forever). You can only have one free-tier account
     per subscription.
4. Click **Review + create → Create**. Wait ~5 minutes for deployment.
5. When done, open the account → **Settings → Keys**. Copy:
   - **URI** → this is your `COSMOS_ENDPOINT`
   - **PRIMARY KEY** → this is your `COSMOS_KEY`

You do **not** need to create the database/containers by hand — the seed script
(step 4) creates the `budgetier` database and all containers with database-level shared
throughput (400 RU/s, well within the free allotment).

> **One account, multiple databases.** The free tier discount (1000 RU/s + 25 GB) applies
> to this Cosmos **account** as a whole, and you only get one free-tier account per
> subscription — but a single account can hold multiple **databases**, all sharing that same
> free pool. If you also want a local-dev database (see the main [README](README.md)),
> create it inside *this same account* (e.g. `COSMOS_DATABASE=budgetier-dev`, same
> `COSMOS_ENDPOINT`/`COSMOS_KEY` as prod) rather than provisioning a second account — a
> second account is billed with no free tier.

---

## 2. Create the Static Web App

1. In the Portal, **Create a resource → Static Web App → Create**.
2. Fill in:
   - **Resource Group**: `budgetier-rg` (same as above).
   - **Name**: e.g. `budgetier`.
   - **Plan type**: **Free**.
   - **Region**: pick one near you.
   - **Deployment source**: **GitHub**. Sign in and authorize, then select your
     **Organization / Repository / Branch (`main`)**.
   - **Build Presets**: **Vue** (or **Custom**). Set:
     - **App location**: `frontend`
     - **Api location**: `api`
     - **Output location**: `dist`
3. Click **Review + create → Create**.

Azure will commit a GitHub Actions workflow to your repo and kick off the first build.

> This repo already ships its own workflow at
> `.github/workflows/azure-static-web-apps.yml`. If Azure also generated one, delete the
> Azure-generated file and keep this one (it references the secret name
> `AZURE_STATIC_WEB_APPS_API_TOKEN`, set in the next step). Having two workflows will cause
> duplicate/failed deploys.

---

## 3. Wire up the deployment token + app settings

### 3a. Deployment token (GitHub secret)

1. Open the Static Web App → **Overview → Manage deployment token**. Copy it.
2. In GitHub: **repo → Settings → Secrets and variables → Actions → New repository secret**:
   - Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`
   - Value: the token you copied.

### 3b. Application settings (backend secrets)

These are the environment variables the Functions API reads at runtime.

1. In the Static Web App → **Settings → Environment variables** (a.k.a. Application settings).
2. Add each of these (Name → Value):

   | Name              | Value |
   |-------------------|-------|
   | `COSMOS_ENDPOINT` | the URI from step 1 |
   | `COSMOS_KEY`      | the PRIMARY KEY from step 1 |
   | `COSMOS_DATABASE` | `budgetier` |
   | `JWT_SECRET`      | a long random string (≥ 32 chars) — generate one below |

   Generate a strong secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

3. **Save.** (Do **not** set `INSECURE_COOKIES` in production — cookies must be Secure.)

> Note: `ADMIN_USERNAME` / `ADMIN_PASSWORD` are only used by the local seed script and do
> **not** need to be added here.

---

## 4. Seed the production database (one time)

The seed script creates the containers, your user login, and the default categories. Run it
locally, pointed at the **production** Cosmos account:

```bash
cd api
npm install

# Provide config via environment variables (PowerShell example):
$env:COSMOS_ENDPOINT="https://budgetier-db.documents.azure.com:443/"
$env:COSMOS_KEY="<primary key>"
$env:COSMOS_DATABASE="budgetier"
$env:ADMIN_USERNAME="oscar"
$env:ADMIN_PASSWORD="<the password you want to log in with>"

npm run seed
```

(Bash/macOS/Linux: use `export VAR=value` instead of `$env:VAR=`.)

You should see it create the database, containers, the user, and 13 categories. To change
your password later, just re-run the seed with a new `ADMIN_PASSWORD` (it upserts the user).

---

## 5. Log in

1. In the Static Web App → **Overview**, open the **URL** (e.g.
   `https://budgetier.azurestaticapps.net`).
2. Sign in with the `ADMIN_USERNAME` / `ADMIN_PASSWORD` you seeded.
3. Add a transaction, set targets on the Categories tab, and check the Balances tab.

---

## 6. (Optional) Custom domain

Static Web App → **Settings → Custom domains → Add**. Follow the DNS validation steps.
HTTPS certificates are provisioned automatically and free.

---

## Redeploying

Just push to `main`:

```bash
git add .
git commit -m "..."
git push
```

The GitHub Actions workflow rebuilds `frontend` + `api` and deploys. Watch progress under the
repo's **Actions** tab.

---

## Troubleshooting

- **Login returns 500 / "Cosmos not configured"** → an Application Setting is missing or
  misspelled. Recheck `COSMOS_ENDPOINT`, `COSMOS_KEY`, `COSMOS_DATABASE`, `JWT_SECRET`, then
  restart isn't needed (SWA picks them up), but re-run the failing request.
- **Login works but you can't stay signed in** → make sure `INSECURE_COOKIES` is **not** set
  in production (the cookie must be Secure over HTTPS).
- **`429 Too many attempts`** → login rate limit tripped; wait ~15 minutes.
- **Cosmos "request rate too large" (429 from DB)** → extremely unlikely at 400 RU/s for one
  user, but you can bump the database throughput in the Portal (Data Explorer → Scale).
- **API build fails in Actions** → confirm the app/api/output locations in the workflow match
  (`frontend` / `api` / `dist`) and that `api/package.json` has a `build` script.
