/**
 * Fixture test for the balances math — no database required.
 * Uses synthetic sample numbers (not real financial data) and asserts the computed
 * derived rows match. Run with:  npx tsc && node dist/scripts/test-balances.js
 */
import { computeBalances } from "../lib/balances-compute";
import { Category, CategoryKind } from "../lib/types";

let failures = 0;
function expect(label: string, got: number, want: number) {
  const ok = Math.abs(got - want) < 0.005;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: got ${got}  want ${want}`);
}

// (name, kind, planned, actual) — synthetic sample data, not real figures.
const fixture: [string, CategoryKind, number, number][] = [
  ["Income", "income", 9000.0, 9350.25],
  ["Tax", "deduction", 2100.0, 2100.0],
  ["401k Traditional", "deduction", 1500.0, 1500.0],
  ["401k Roth", "deduction", 600.0, 600.0],
  ["Housing", "need", 1800.0, 1800.0],
  ["Grocery", "need", 250.0, 240.18],
  ["Medical/Health", "need", 90.0, 90.0],
  ["Commute", "need", 300.0, 65.0],
  ["Other Need", "need", 0.0, 0.0],
  ["Brokerage/HYSA/IRA", "investment", 1200.0, 800.0],
  ["Charity", "giving", 0.0, 75.0],
  ["Travel Savings", "savings", 180.0, 0.0],
  ["Discretionary", "discretionary", 0.0, 1900.0],
];

const categories: Category[] = fixture.map(([name, kind], i) => ({
  id: `c${i}`,
  name,
  kind,
  color: "#000000",
  sortOrder: i * 10,
}));
const plannedByCat = new Map<string, number>();
const actualByCat = new Map<string, number>();
fixture.forEach(([, , planned, actual], i) => {
  plannedByCat.set(`c${i}`, planned);
  actualByCat.set(`c${i}`, actual);
});

const { totals } = computeBalances(categories, plannedByCat, actualByCat);

console.log("--- Derived rows (should match the sheet) ---");
expect("Net Disposable planned", totals.netDisposable.planned, 4800.0);
expect("Net Disposable actual", totals.netDisposable.actual, 5150.25);
expect("Remaining planned", totals.remaining.planned, 1160.0);
expect("Remaining actual", totals.remaining.actual, 2155.07);
expect("Discretionary planned (plug)", totals.discretionary.planned, 980.0);
expect("Discretionary actual", totals.discretionary.actual, 1900.0);

console.log(failures === 0 ? "\nAll fixture checks passed ✅" : `\n${failures} check(s) FAILED ❌`);
process.exit(failures === 0 ? 0 : 1);
