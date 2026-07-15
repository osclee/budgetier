/**
 * Seed script — creates containers, the single user, and the default categories.
 *
 * Run with:  npm run seed --prefix api
 *
 * Reads config from process.env; if not already set, it loads api/local.settings.json
 * (the same file the Functions host uses) so you only maintain one config file locally.
 * When seeding a PRODUCTION database, set the env vars directly instead (see AZURE_SETUP.md).
 */
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcryptjs";
import { ensureSchema, container } from "../lib/cosmos";
import { Category, User } from "../lib/types";

function loadLocalSettings(): void {
  if (process.env.COSMOS_ENDPOINT) return; // already configured via real env
  const file = path.resolve(process.cwd(), "local.settings.json");
  if (!fs.existsSync(file)) return;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    const values = parsed?.Values ?? {};
    for (const [k, v] of Object.entries(values)) {
      if (process.env[k] === undefined && typeof v === "string") {
        process.env[k] = v;
      }
    }
    console.log("Loaded config from local.settings.json");
  } catch (err) {
    console.warn("Could not parse local.settings.json:", err);
  }
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Default categories mirror the Google Sheet, with colors sampled from the screenshot.
const DEFAULT_CATEGORIES: Omit<Category, "id">[] = [
  { name: "Income", kind: "income", color: "#7030A0", sortOrder: 10 },
  { name: "Tax", kind: "deduction", color: "#404040", sortOrder: 20 },
  { name: "401k Traditional", kind: "deduction", color: "#F8CBAD", sortOrder: 30, countsAsInvestment: true },
  { name: "401k Roth", kind: "deduction", color: "#843C0C", sortOrder: 40, countsAsInvestment: true },
  { name: "Housing", kind: "need", color: "#8D7B68", sortOrder: 50 },
  { name: "Grocery", kind: "need", color: "#A9D08E", sortOrder: 60 },
  { name: "Medical/Health", kind: "need", color: "#E06666", sortOrder: 70 },
  { name: "Commute", kind: "need", color: "#E83E8C", sortOrder: 80 },
  { name: "Other Need", kind: "need", color: "#BF9000", sortOrder: 90 },
  { name: "Brokerage", kind: "investment", color: "#2E75B6", sortOrder: 100 },
  { name: "IRA", kind: "investment", color: "#1F4E79", sortOrder: 110 },
  { name: "HYSA", kind: "investment", color: "#9DC3E6", sortOrder: 120 },
  { name: "Charity", kind: "giving", color: "#C55A11", sortOrder: 130 },
  { name: "Travel Savings", kind: "savings", color: "#38761D", sortOrder: 140 },
  { name: "Discretionary", kind: "discretionary", color: "#BDD7EE", sortOrder: 150 },
];

async function seedUser(): Promise<void> {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD must be set to seed the user.");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user: User = { id: "user", username, passwordHash };
  await container("users").items.upsert(user);
  console.log(`Seeded user "${username}" (id: user).`);
}

async function seedCategories(): Promise<void> {
  const existing = await container("categories").items.readAll<Category>().fetchAll();
  if (existing.resources.length > 0) {
    console.log(
      `Categories already present (${existing.resources.length}) — skipping category seed.`
    );
    return;
  }
  for (const c of DEFAULT_CATEGORIES) {
    const cat: Category = { id: slug(c.name), ...c };
    await container("categories").items.create(cat);
  }
  console.log(`Seeded ${DEFAULT_CATEGORIES.length} default categories.`);
}

async function main(): Promise<void> {
  loadLocalSettings();
  console.log("Ensuring database + containers...");
  await ensureSchema();
  await seedUser();
  await seedCategories();
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
