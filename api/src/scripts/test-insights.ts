/**
 * Fixture test for insights-compute.ts — no database required. Exercises the
 * highest-risk logic (date/streak math): an off-track month breaking a streak, a
 * fully-clean month, the current partial month excluded from eligibility, and a
 * multi-month zero-spend run spanning a month boundary.
 * Run with:  npx tsc && node dist/scripts/test-insights.js
 */
import { computeInsights } from "../lib/insights-compute";
import { Category, Transaction, Budget } from "../lib/types";

let failures = 0;
function expect(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}  want ${JSON.stringify(want)}`);
}

const categories: Category[] = [
  { id: "c0", name: "Income", kind: "income", color: "#000", sortOrder: 10 },
  { id: "c1", name: "Discretionary", kind: "discretionary", color: "#000", sortOrder: 20 },
  { id: "c2", name: "Investment", kind: "investment", color: "#000", sortOrder: 30 },
];

const budgets: Budget[] = [
  { id: "2026-05:c0", yearMonth: "2026-05", categoryId: "c0", planned: 5000 },
  { id: "2026-05:c2", yearMonth: "2026-05", categoryId: "c2", planned: 500 },
  { id: "2026-06:c0", yearMonth: "2026-06", categoryId: "c0", planned: 5000 },
  { id: "2026-06:c2", yearMonth: "2026-06", categoryId: "c2", planned: 500 },
  // July: no budget rows at all — simulates "hasn't budgeted this month yet".
];

const transactions: Transaction[] = [
  // May — investment $600 (over $500 target, on-track); discretionary on 05-03 and 05-10 only.
  { id: "t1", yearMonth: "2026-05", date: "2026-05-01", description: "Paycheck", amount: 5000, categoryId: "c0" },
  { id: "t2", yearMonth: "2026-05", date: "2026-05-01", description: "401k", amount: 600, categoryId: "c2" },
  { id: "t3", yearMonth: "2026-05", date: "2026-05-03", description: "Coffee", amount: 20, categoryId: "c1" },
  { id: "t4", yearMonth: "2026-05", date: "2026-05-10", description: "Dinner", amount: 30, categoryId: "c1" },
  // June — investment $400 (under $500 target, off-track); zero discretionary spend all month.
  { id: "t5", yearMonth: "2026-06", date: "2026-06-01", description: "Paycheck", amount: 5000, categoryId: "c0" },
  { id: "t6", yearMonth: "2026-06", date: "2026-06-01", description: "401k", amount: 400, categoryId: "c2" },
  // July (partial, through today 07-15) — one discretionary spend today.
  { id: "t7", yearMonth: "2026-07", date: "2026-07-01", description: "Paycheck", amount: 2000, categoryId: "c0" },
  { id: "t8", yearMonth: "2026-07", date: "2026-07-01", description: "401k", amount: 100, categoryId: "c2" },
  { id: "t9", yearMonth: "2026-07", date: "2026-07-15", description: "Coffee", amount: 15, categoryId: "c1" },
];

const result = computeInsights({
  months: 3,
  today: "2026-07-15",
  categories,
  transactions,
  budgets,
  allTimeInvestedActual: 1100,
  allTimeSavedActual: 0,
});

console.log("--- Window ---");
expect("windowStart", result.windowStart, "2026-05");
expect("windowEnd", result.windowEnd, "2026-07");
expect("monthly count", result.monthly.length, 3);
expect("July is partial", result.monthly[2].isCurrentPartialMonth, true);
expect("May is not partial", result.monthly[0].isCurrentPartialMonth, false);

console.log("--- Investment streak ---");
expect("investmentStreak.monthsConsidered", result.investmentStreak.monthsConsidered, 2);
expect("investmentStreak.currentStreak", result.investmentStreak.currentStreak, 0);
expect("investmentStreak.bestStreak", result.investmentStreak.bestStreak, 1);

console.log("--- Zero-spend days ---");
expect("zeroSpend.currentStreak", result.zeroSpend.currentStreak, 0);
expect("zeroSpend.bestStreak", result.zeroSpend.bestStreak, 65);

console.log("--- Headline (sanity) ---");
expect("totalInvestedWindow", result.headline.totalInvestedWindow, 1100);
expect("totalIncomeWindow", result.headline.totalIncomeWindow, 12000);

// --- Scenario 2: countsAsInvestment (401k fix) ---
// A deduction-kind category flagged countsAsInvestment must be included in "invested"
// totals alongside a real investment-kind category, while a plain deduction (Tax) must
// NOT be — and the Balances-facing totals.investment must stay untouched (kind-only),
// proving this fix doesn't alter the already-verified Balances math.
const flagCategories: Category[] = [
  { id: "d0", name: "Income", kind: "income", color: "#000", sortOrder: 10 },
  { id: "d1", name: "Tax", kind: "deduction", color: "#000", sortOrder: 20 },
  { id: "d2", name: "401k Traditional", kind: "deduction", color: "#000", sortOrder: 30, countsAsInvestment: true },
  { id: "d3", name: "Brokerage", kind: "investment", color: "#000", sortOrder: 40 },
];
const flagBudgets: Budget[] = [
  { id: "2026-07:d2", yearMonth: "2026-07", categoryId: "d2", planned: 250 },
  { id: "2026-07:d3", yearMonth: "2026-07", categoryId: "d3", planned: 200 },
];
const flagTransactions: Transaction[] = [
  { id: "f1", yearMonth: "2026-07", date: "2026-07-01", description: "Paycheck", amount: 6000, categoryId: "d0" },
  { id: "f2", yearMonth: "2026-07", date: "2026-07-01", description: "Tax withheld", amount: 500, categoryId: "d1" },
  { id: "f3", yearMonth: "2026-07", date: "2026-07-01", description: "401k contribution", amount: 300, categoryId: "d2" },
  { id: "f4", yearMonth: "2026-07", date: "2026-07-01", description: "Brokerage buy", amount: 200, categoryId: "d3" },
];

const flagResult = computeInsights({
  months: 1,
  today: "2026-07-15",
  categories: flagCategories,
  transactions: flagTransactions,
  budgets: flagBudgets,
  allTimeInvestedActual: 500,
  allTimeSavedActual: 0,
});

console.log("--- countsAsInvestment (401k fix) ---");
expect("investedActual includes 401k + brokerage", flagResult.monthly[0].investedActual, 500);
expect("investedPlanned includes 401k + brokerage", flagResult.monthly[0].investedPlanned, 450);
expect("totalInvestedWindow includes 401k + brokerage", flagResult.headline.totalInvestedWindow, 500);
expect(
  "totals.investment.actual stays kind-only (Balances math untouched)",
  flagResult.monthly[0].totals.investment.actual,
  200
);
expect("trend.investmentActual reflects the broader invested total", flagResult.trend[0].investmentActual, 500);

// --- Scenario 3: empty months excluded from the report ---
// June has zero budget rows AND zero transactions — a true gap, not just a quiet month.
// It must not appear in `monthly`/`trend` at all, and must not drag down averages/best-worst.
const gapCategories: Category[] = [
  { id: "g0", name: "Income", kind: "income", color: "#000", sortOrder: 10 },
  { id: "g1", name: "Discretionary", kind: "discretionary", color: "#000", sortOrder: 20 },
];
const gapBudgets: Budget[] = [
  { id: "2026-05:g0", yearMonth: "2026-05", categoryId: "g0", planned: 4000 },
  { id: "2026-07:g0", yearMonth: "2026-07", categoryId: "g0", planned: 4000 },
  // June: no budget rows at all.
];
const gapTransactions: Transaction[] = [
  { id: "g-t1", yearMonth: "2026-05", date: "2026-05-01", description: "Paycheck", amount: 4000, categoryId: "g0" },
  { id: "g-t2", yearMonth: "2026-05", date: "2026-05-05", description: "Shopping", amount: 100, categoryId: "g1" },
  // June: no transactions at all.
  { id: "g-t3", yearMonth: "2026-07", date: "2026-07-01", description: "Paycheck", amount: 4000, categoryId: "g0" },
  { id: "g-t4", yearMonth: "2026-07", date: "2026-07-05", description: "Shopping", amount: 300, categoryId: "g1" },
];

const gapResult = computeInsights({
  months: 3,
  today: "2026-07-15",
  categories: gapCategories,
  transactions: gapTransactions,
  budgets: gapBudgets,
  allTimeInvestedActual: 0,
  allTimeSavedActual: 0,
});

console.log("--- Empty months excluded ---");
expect("June (empty) excluded from monthly", gapResult.monthly.length, 2);
expect(
  "only May and July remain, in order",
  gapResult.monthly.map((m) => m.yearMonth),
  ["2026-05", "2026-07"]
);
expect("trend also excludes June", gapResult.trend.length, 2);
// Average/best-worst only see May (100) — July is the current partial month, excluded as usual.
expect("avg discretionary unskewed by the June gap", gapResult.headline.avgMonthlyDiscretionaryActual, 100);
expect("best month is May, not a phantom June $0", gapResult.headline.bestDiscretionaryMonth?.yearMonth, "2026-05");

console.log(failures === 0 ? "\nAll fixture checks passed ✅" : `\n${failures} check(s) FAILED ❌`);
process.exit(failures === 0 ? 0 : 1);
