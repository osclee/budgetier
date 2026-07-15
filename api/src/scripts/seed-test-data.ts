/**
 * Seeds synthetic budgets + transactions for dev/testing.
 *
 * Generates `MONTHS` months of data (most recent = current month) with a planned
 * Budget per category per month, plus a realistic scatter of Transactions.
 *
 * Run with:  npm run seed:test-data --prefix api
 *
 * Loads config from api/local.settings.json the same way seed.ts does, so this
 * targets whatever COSMOS_DATABASE that file points at (COSMOS_DATABASE=budgetier-dev).
 * Safe to re-run: it only ever creates new items with fresh random ids/content, so
 * re-running adds more data rather than overwriting. Run scripts/clear-test-data.ts
 * (if desired) or delete the containers' contents in the Azure portal to reset.
 */
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { container } from "../lib/cosmos";
import { Budget, Category, Transaction } from "../lib/types";

function loadLocalSettings(): void {
  if (process.env.COSMOS_ENDPOINT) return;
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

const MONTHS = 3; // how many months of history to generate, most recent = current month

// Planned monthly amount per category (baseline) and typical transaction behavior.
// `txns` describes how to break the planned amount into individual transactions:
//  - "single": one transaction for ~the full planned amount (e.g. paycheck, rent)
//  - "few": 2-4 transactions splitting the planned amount
//  - "many": 6-14 small transactions scattered through the month (e.g. groceries, discretionary)
const CATEGORY_PROFILES: Record<
  string,
  { planned: number; txns: "single" | "few" | "many"; descriptions: string[] }
> = {
  Income: { planned: 11500, txns: "few", descriptions: ["Paycheck", "Bonus", "Freelance Income"] },
  Tax: { planned: 2700, txns: "single", descriptions: ["Federal + State Withholding"] },
  "401k Traditional": { planned: 900, txns: "single", descriptions: ["401k Traditional Contribution"] },
  "401k Roth": { planned: 400, txns: "single", descriptions: ["401k Roth Contribution"] },
  Housing: { planned: 2300, txns: "few", descriptions: ["Rent", "Renters Insurance", "HOA Fee"] },
  Grocery: {
    planned: 550,
    txns: "many",
    descriptions: ["Whole Foods", "Trader Joe's", "Safeway", "Costco", "Local Market"],
  },
  "Medical/Health": {
    planned: 180,
    txns: "few",
    descriptions: ["Pharmacy Copay", "Dentist Visit", "Gym Membership", "Urgent Care"],
  },
  Commute: {
    planned: 220,
    txns: "many",
    descriptions: ["Gas Station", "Transit Pass", "Parking", "Rideshare", "Car Wash"],
  },
  "Other Need": {
    planned: 150,
    txns: "few",
    descriptions: ["Phone Bill", "Internet Bill", "Utilities", "Renters Supplies"],
  },
  Brokerage: { planned: 500, txns: "single", descriptions: ["Brokerage Auto-Invest"] },
  IRA: { planned: 500, txns: "single", descriptions: ["IRA Contribution"] },
  HYSA: { planned: 300, txns: "single", descriptions: ["HYSA Transfer"] },
  Charity: { planned: 150, txns: "few", descriptions: ["Church Donation", "Red Cross", "Local Food Bank"] },
  "Travel Savings": { planned: 200, txns: "single", descriptions: ["Travel Fund Transfer"] },
  Discretionary: {
    planned: 450,
    txns: "many",
    descriptions: [
      "Restaurant",
      "Coffee Shop",
      "Movie Tickets",
      "Amazon Order",
      "Concert Tickets",
      "Bar Tab",
      "Streaming Subscription",
      "Bookstore",
      "Hobby Supplies",
    ],
  },
};

function yearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function jitter(base: number, pct: number): number {
  const factor = 1 + (Math.random() * 2 - 1) * pct;
  return Math.round(base * factor * 100) / 100;
}

function splitAmount(total: number, parts: number): number[] {
  const weights = Array.from({ length: parts }, () => Math.random() + 0.3);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const amounts = weights.map((w) => Math.round(((w / weightSum) * total) / 0.5) * 0.5);
  const diff = Math.round((total - amounts.reduce((a, b) => a + b, 0)) * 100) / 100;
  amounts[0] = Math.round((amounts[0] + diff) * 100) / 100;
  return amounts;
}

function transactionCount(mode: "single" | "few" | "many"): number {
  if (mode === "single") return 1;
  if (mode === "few") return randInt(2, 4);
  return randInt(6, 14);
}

function buildMonthData(
  ym: string,
  year: number,
  monthIndex: number,
  categories: Category[]
): { budgets: Budget[]; transactions: Transaction[] } {
  const budgets: Budget[] = [];
  const transactions: Transaction[] = [];
  const lastDay = daysInMonth(year, monthIndex);

  for (const cat of categories) {
    const profile = CATEGORY_PROFILES[cat.name];
    if (!profile) continue; // skip unknown/custom categories

    const plannedAmount = jitter(profile.planned, 0.08);
    budgets.push({
      id: `${ym}:${cat.id}`,
      yearMonth: ym,
      categoryId: cat.id,
      planned: plannedAmount,
    });

    const actualTotal = jitter(plannedAmount, 0.15);
    const count = transactionCount(profile.txns);
    const amounts = splitAmount(actualTotal, count);

    for (const amt of amounts) {
      const day = randInt(1, lastDay);
      const date = `${ym}-${String(day).padStart(2, "0")}`;
      transactions.push({
        id: randomUUID(),
        yearMonth: ym,
        date,
        description: pick(profile.descriptions),
        amount: Math.abs(amt),
        categoryId: cat.id,
      });
    }
  }

  return { budgets, transactions };
}

async function main(): Promise<void> {
  loadLocalSettings();

  const categoriesResult = await container("categories").items.readAll<Category>().fetchAll();
  const categories = categoriesResult.resources;
  if (categories.length === 0) {
    throw new Error("No categories found — run `npm run seed` first to create default categories.");
  }

  const now = new Date();
  let totalBudgets = 0;
  let totalTxns = 0;

  for (let i = MONTHS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = yearMonth(d);
    const { budgets, transactions } = buildMonthData(ym, d.getFullYear(), d.getMonth(), categories);

    for (const b of budgets) {
      await container("budgets").items.upsert(b);
    }
    for (const t of transactions) {
      await container("transactions").items.create(t);
    }

    totalBudgets += budgets.length;
    totalTxns += transactions.length;
    console.log(`Seeded ${ym}: ${budgets.length} budgets, ${transactions.length} transactions.`);
  }

  console.log(`Done. Seeded ${totalBudgets} budgets and ${totalTxns} transactions across ${MONTHS} months.`);
}

main().catch((err) => {
  console.error("Seed test data failed:", err);
  process.exit(1);
});
