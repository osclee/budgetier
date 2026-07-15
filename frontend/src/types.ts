export type CategoryKind =
  | "income"
  | "deduction"
  | "need"
  | "investment"
  | "giving"
  | "savings"
  | "discretionary";

export const CATEGORY_KINDS: { value: CategoryKind; label: string }[] = [
  { value: "income", label: "Income" },
  { value: "deduction", label: "Deduction (Tax / 401k)" },
  { value: "need", label: "Need" },
  { value: "investment", label: "Investment" },
  { value: "giving", label: "Giving" },
  { value: "savings", label: "Savings" },
  { value: "discretionary", label: "Discretionary" },
];

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  color: string;
  sortOrder: number;
  countsAsInvestment?: boolean;
}

export interface Transaction {
  id: string;
  yearMonth: string;
  date: string;
  description: string;
  amount: number;
  categoryId: string;
  recurringId?: string;
}

export interface Budget {
  id: string;
  yearMonth: string;
  categoryId: string;
  planned: number;
}

export interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  categoryId: string;
  dayOfMonth: number;
  active: boolean;
}

export interface RecurringApplyResult {
  created: Transaction[];
  skipped: number;
}

export type BalanceRow =
  | {
      type: "category";
      id: string;
      name: string;
      color: string;
      kind: CategoryKind;
      planned: number;
      actual: number;
      diff: number;
    }
  | { type: "derived"; key: string; label: string; planned: number; actual: number; diff: number }
  | { type: "spacer" };

export interface BalancesResponse {
  month: string;
  rows: BalanceRow[];
  totals: Record<string, { planned: number; actual: number; diff: number }>;
}

// --- Insights ---

export interface Money {
  planned: number;
  actual: number;
  diff: number;
}

export interface MonthBreakdown {
  yearMonth: string;
  totals: Record<string, Money>;
  isCurrentPartialMonth: boolean;
}

export interface TrendPoint {
  yearMonth: string;
  incomeActual: number;
  discretionaryActual: number;
  discretionaryPlanned: number;
  investmentActual: number;
  investmentPlanned: number;
  needsActual: number;
}

export interface HeadlineStats {
  windowStart: string;
  windowEnd: string;
  totalInvestedWindow: number;
  totalSavedWindow: number;
  totalIncomeWindow: number;
  totalDiscretionaryWindow: number;
  avgMonthlyDiscretionaryActual: number;
  avgMonthlyDiscretionaryPlanned: number;
  savingsRatePct: number | null;
  bestDiscretionaryMonth: { yearMonth: string; actual: number } | null;
  worstDiscretionaryMonth: { yearMonth: string; actual: number } | null;
}

export interface AllTimeStats {
  totalInvested: number;
  totalSaved: number;
}

export interface ZeroSpendDay {
  date: string;
  zeroSpend: boolean;
}

export interface ZeroSpendStats {
  trackedDays: number;
  zeroSpendDays: number;
  zeroSpendRatePct: number | null;
  currentStreak: number;
  bestStreak: number;
  days: ZeroSpendDay[];
}

export interface MonthlyStreak {
  currentStreak: number;
  bestStreak: number;
  monthsConsidered: number;
}

export interface BadgeTier {
  tier: number;
  threshold: number;
  label: string;
  unlocked: boolean;
}

export type BadgeId =
  | "zero-spend-streak"
  | "investment-streak"
  | "discretionary-streak"
  | "invested-milestone"
  | "saved-milestone";

export interface BadgeFamily {
  id: BadgeId;
  label: string;
  description: string;
  unit: "days" | "months" | "dollars";
  current: number;
  tiers: BadgeTier[];
  nextTier: { threshold: number; remaining: number } | null;
}

export interface InsightsResponse {
  months: number;
  windowStart: string;
  windowEnd: string;
  today: string;
  monthly: MonthBreakdown[];
  trend: TrendPoint[];
  headline: HeadlineStats;
  allTime: AllTimeStats;
  zeroSpend: ZeroSpendStats;
  investmentStreak: MonthlyStreak;
  discretionaryStreak: MonthlyStreak;
  badges: BadgeFamily[];
}
