// Category "kind" drives grouping and the computed rows in the Balances view.
export type CategoryKind =
  | "income" // Gross Income (inflow)
  | "deduction" // Tax, 401k Traditional, 401k Roth (subtracted from gross)
  | "need" // Housing, Grocery, Medical/Health, Commute, Other Need
  | "investment" // Brokerage/HYSA/IRA
  | "giving" // Charity
  | "savings" // Travel Savings
  | "discretionary"; // Monthly discretionary spend

export const CATEGORY_KINDS: CategoryKind[] = [
  "income",
  "deduction",
  "need",
  "investment",
  "giving",
  "savings",
  "discretionary",
];

export interface User {
  id: string;
  username: string;
  passwordHash: string;
}

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  color: string; // hex, used in the UI
  sortOrder: number;
  // Lets a category count toward Insights' "invested" totals independent of its `kind` —
  // e.g. 401k contributions are `kind: "deduction"` (correctly subtracted before Net
  // Disposable in the Balances math) but are still real investing, so this flag lets
  // them also count toward invested totals/badges without changing the Balances math.
  countsAsInvestment?: boolean;
}

export interface Budget {
  id: string; // `${yearMonth}:${categoryId}`
  yearMonth: string; // "2026-02"
  categoryId: string;
  planned: number;
}

export interface Transaction {
  id: string;
  yearMonth: string; // "2026-02" — partition key, derived from date
  date: string; // ISO "2026-02-14"
  description: string;
  amount: number;
  categoryId: string;
  recurringId?: string; // set when this transaction was materialized from a RecurringTransaction
}

export interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  categoryId: string;
  dayOfMonth: number; // 1-31, clamped to the last day of shorter months when applied
  active: boolean;
}

export interface JwtPayload {
  sub: string; // user id
  username: string;
}
