import { Category, Transaction, Budget } from "./types";
import { computeBalances, Money, round2 } from "./balances-compute";
import { monthsInRange, daysInRange, shiftMonth } from "./date";
import { yearMonthOf } from "./validate";

const round1 = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;

export interface InsightsInput {
  months: number; // 1-12, validated by the caller
  today: string; // "YYYY-MM-DD" — threaded in, never computed inside (testability)
  categories: Category[];
  transactions: Transaction[]; // pre-filtered to [windowStart, windowEnd]
  budgets: Budget[]; // pre-filtered to [windowStart, windowEnd]
  allTimeInvestedActual: number;
  allTimeSavedActual: number;
}

export interface MonthBreakdown {
  yearMonth: string;
  totals: Record<string, Money>; // same shape as BalancesResult.totals
  isCurrentPartialMonth: boolean;
  // "Invested" actual/planned across investment-kind + countsAsInvestment categories
  // (e.g. 401k). Computed separately from `totals.investment` (which is kind-only, and
  // must stay that way since it drives the unchanged Balances page math) — everything
  // in Insights that means "how much did I invest" should read these instead.
  investedActual: number;
  investedPlanned: number;
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

export interface BadgeFamily {
  id: "zero-spend-streak" | "investment-streak" | "discretionary-streak" | "invested-milestone" | "saved-milestone";
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

function longestRun(flags: boolean[]): number {
  let best = 0;
  let cur = 0;
  for (const f of flags) {
    cur = f ? cur + 1 : 0;
    if (cur > best) best = cur;
  }
  return best;
}

function currentRun(flags: boolean[]): number {
  let cur = 0;
  for (let i = flags.length - 1; i >= 0; i--) {
    if (!flags[i]) break;
    cur++;
  }
  return cur;
}

/** A month with no budget data and no transactions at all — nothing to report on. */
function isEmptyMonth(totals: Record<string, Money>): boolean {
  return Object.values(totals).every((m) => m.planned === 0 && m.actual === 0);
}

export function computeZeroSpendStats(
  categories: Category[],
  transactions: Transaction[],
  windowStart: string,
  today: string
): ZeroSpendStats {
  if (transactions.length === 0) {
    return { trackedDays: 0, zeroSpendDays: 0, zeroSpendRatePct: null, currentStreak: 0, bestStreak: 0, days: [] };
  }

  const discretionaryCatIds = new Set(
    categories.filter((c) => c.kind === "discretionary").map((c) => c.id)
  );
  const discretionaryTxDates = new Set(
    transactions
      .filter((t) => discretionaryCatIds.has(t.categoryId) && t.amount > 0)
      .map((t) => t.date)
  );

  const earliestActivityDate = transactions.reduce(
    (min, t) => (t.date < min ? t.date : min),
    transactions[0].date
  );
  const rangeStart = windowStart + "-01" > earliestActivityDate ? windowStart + "-01" : earliestActivityDate;
  const rangeEnd = today;

  const dayList = daysInRange(rangeStart, rangeEnd);
  const days: ZeroSpendDay[] = dayList.map((d) => ({ date: d, zeroSpend: !discretionaryTxDates.has(d) }));
  const flags = days.map((d) => d.zeroSpend);

  const trackedDays = days.length;
  const zeroSpendDays = flags.filter(Boolean).length;

  return {
    trackedDays,
    zeroSpendDays,
    zeroSpendRatePct: trackedDays > 0 ? round1((zeroSpendDays / trackedDays) * 100) : null,
    currentStreak: currentRun(flags),
    bestStreak: longestRun(flags),
    days,
  };
}

export function computeMonthlyStreak(
  monthly: MonthBreakdown[],
  budgets: Budget[],
  kind: "investment" | "discretionary"
): MonthlyStreak {
  const budgetedMonths = new Set(budgets.map((b) => b.yearMonth));
  const completeMonths = monthly.filter((m) => !m.isCurrentPartialMonth);
  const eligible = completeMonths.filter((m) => budgetedMonths.has(m.yearMonth));

  const onTrack = (m: MonthBreakdown): boolean =>
    kind === "discretionary"
      ? m.totals.discretionary.actual <= m.totals.discretionary.planned
      : m.investedActual >= m.investedPlanned;

  const flags = eligible.map(onTrack);

  return {
    currentStreak: currentRun(flags),
    bestStreak: longestRun(flags),
    monthsConsidered: eligible.length,
  };
}

const DOLLAR_TIERS = [1000, 5000, 10000, 25000, 50000, 100000];
const DAY_STREAK_TIERS = [3, 7, 14, 30];
const MONTH_STREAK_TIERS = [3, 6, 12];

function buildBadgeFamily(
  id: BadgeFamily["id"],
  label: string,
  description: string,
  unit: BadgeFamily["unit"],
  tierThresholds: number[],
  current: number
): BadgeFamily {
  const tiers: BadgeTier[] = tierThresholds.map((threshold, i) => ({
    tier: i + 1,
    threshold,
    label:
      unit === "dollars"
        ? `$${threshold.toLocaleString("en-US")}`
        : unit === "days"
          ? `${threshold} Day${threshold === 1 ? "" : "s"}`
          : `${threshold} Month${threshold === 1 ? "" : "s"}`,
    unlocked: current >= threshold,
  }));
  const firstLocked = tiers.find((t) => !t.unlocked);
  return {
    id,
    label,
    description,
    unit,
    current: round2(current),
    tiers,
    nextTier: firstLocked
      ? { threshold: firstLocked.threshold, remaining: round2(firstLocked.threshold - current) }
      : null,
  };
}

export function computeInsights(input: InsightsInput): InsightsResponse {
  const windowEnd = input.today.slice(0, 7);
  const windowStart = shiftMonth(windowEnd, -(input.months - 1));
  const monthList = monthsInRange(windowStart, windowEnd);
  const currentMonth = yearMonthOf(input.today);

  // See MonthBreakdown.investedActual/investedPlanned: this set is broader than
  // kind === "investment" alone (includes countsAsInvestment categories like 401k).
  const investedCategoryIds = new Set(
    input.categories.filter((c) => c.kind === "investment" || c.countsAsInvestment).map((c) => c.id)
  );
  const sumOverIds = (byCat: Map<string, number>, ids: Set<string>): number => {
    let sum = 0;
    for (const [catId, amt] of byCat) if (ids.has(catId)) sum += amt;
    return sum;
  };

  // Months with no budget data and no transactions at all are excluded from the report
  // entirely (not shown as a zeroed-out row) — nothing was "filled in" for them, so
  // trends/averages/best-worst-month would only be skewed by including a blank gap.
  const monthly: MonthBreakdown[] = monthList
    .map((ym) => {
      const plannedByCat = new Map<string, number>();
      for (const b of input.budgets) if (b.yearMonth === ym) plannedByCat.set(b.categoryId, b.planned);
      const actualByCat = new Map<string, number>();
      for (const t of input.transactions) {
        if (t.yearMonth === ym) actualByCat.set(t.categoryId, (actualByCat.get(t.categoryId) ?? 0) + t.amount);
      }
      const { totals } = computeBalances(input.categories, plannedByCat, actualByCat);
      return {
        yearMonth: ym,
        totals,
        isCurrentPartialMonth: ym === currentMonth,
        investedActual: round2(sumOverIds(actualByCat, investedCategoryIds)),
        investedPlanned: round2(sumOverIds(plannedByCat, investedCategoryIds)),
      };
    })
    .filter((m) => !isEmptyMonth(m.totals));

  const trend: TrendPoint[] = monthly.map((m) => ({
    yearMonth: m.yearMonth,
    incomeActual: m.totals.income.actual,
    discretionaryActual: m.totals.discretionary.actual,
    discretionaryPlanned: m.totals.discretionary.planned,
    investmentActual: m.investedActual,
    investmentPlanned: m.investedPlanned,
    needsActual: m.totals.need.actual,
  }));

  const completeMonths = monthly.filter((m) => !m.isCurrentPartialMonth);

  const totalInvestedWindow = round2(monthly.reduce((s, m) => s + m.investedActual, 0));
  const totalSavedWindow = round2(monthly.reduce((s, m) => s + m.totals.savings.actual, 0));
  const totalIncomeWindow = round2(monthly.reduce((s, m) => s + m.totals.income.actual, 0));
  const totalDiscretionaryWindow = round2(monthly.reduce((s, m) => s + m.totals.discretionary.actual, 0));

  const avgMonthlyDiscretionaryActual = completeMonths.length
    ? round2(completeMonths.reduce((s, m) => s + m.totals.discretionary.actual, 0) / completeMonths.length)
    : 0;
  const avgMonthlyDiscretionaryPlanned = completeMonths.length
    ? round2(completeMonths.reduce((s, m) => s + m.totals.discretionary.planned, 0) / completeMonths.length)
    : 0;

  let bestDiscretionaryMonth: HeadlineStats["bestDiscretionaryMonth"] = null;
  let worstDiscretionaryMonth: HeadlineStats["worstDiscretionaryMonth"] = null;
  for (const m of completeMonths) {
    const actual = m.totals.discretionary.actual;
    if (!bestDiscretionaryMonth || actual < bestDiscretionaryMonth.actual) {
      bestDiscretionaryMonth = { yearMonth: m.yearMonth, actual };
    }
    if (!worstDiscretionaryMonth || actual > worstDiscretionaryMonth.actual) {
      worstDiscretionaryMonth = { yearMonth: m.yearMonth, actual };
    }
  }

  const headline: HeadlineStats = {
    windowStart,
    windowEnd,
    totalInvestedWindow,
    totalSavedWindow,
    totalIncomeWindow,
    totalDiscretionaryWindow,
    avgMonthlyDiscretionaryActual,
    avgMonthlyDiscretionaryPlanned,
    savingsRatePct:
      totalIncomeWindow > 0
        ? round1(((totalInvestedWindow + totalSavedWindow) / totalIncomeWindow) * 100)
        : null,
    bestDiscretionaryMonth,
    worstDiscretionaryMonth,
  };

  const allTime: AllTimeStats = {
    totalInvested: round2(input.allTimeInvestedActual),
    totalSaved: round2(input.allTimeSavedActual),
  };

  const zeroSpend = computeZeroSpendStats(input.categories, input.transactions, windowStart, input.today);
  const investmentStreak = computeMonthlyStreak(monthly, input.budgets, "investment");
  const discretionaryStreak = computeMonthlyStreak(monthly, input.budgets, "discretionary");

  const badges: BadgeFamily[] = [
    buildBadgeFamily(
      "zero-spend-streak",
      "Zero-Spend Streak",
      "Consecutive days with no discretionary spending",
      "days",
      DAY_STREAK_TIERS,
      zeroSpend.bestStreak
    ),
    buildBadgeFamily(
      "investment-streak",
      "Investing Streak",
      "Consecutive months hitting your investment target",
      "months",
      MONTH_STREAK_TIERS,
      investmentStreak.currentStreak
    ),
    buildBadgeFamily(
      "discretionary-streak",
      "Under Budget Streak",
      "Consecutive months at or under your discretionary spend",
      "months",
      MONTH_STREAK_TIERS,
      discretionaryStreak.currentStreak
    ),
    buildBadgeFamily(
      "invested-milestone",
      "Invested Milestones",
      "Total invested, all time",
      "dollars",
      DOLLAR_TIERS,
      allTime.totalInvested
    ),
    buildBadgeFamily(
      "saved-milestone",
      "Saved Milestones",
      "Total saved, all time",
      "dollars",
      DOLLAR_TIERS,
      allTime.totalSaved
    ),
  ];

  return {
    months: input.months,
    windowStart,
    windowEnd,
    today: input.today,
    monthly,
    trend,
    headline,
    allTime,
    zeroSpend,
    investmentStreak,
    discretionaryStreak,
    badges,
  };
}
