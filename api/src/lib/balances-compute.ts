import { Category, CategoryKind } from "./types";

export interface Money {
  planned: number;
  actual: number;
  diff: number;
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

export interface BalancesResult {
  rows: BalanceRow[];
  totals: Record<string, Money>;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const money = (planned: number, actual: number): Money => ({
  planned: round2(planned),
  actual: round2(actual),
  diff: round2(actual - planned),
});

/**
 * Pure balances computation — reproduces the Google-Sheet math. Kept free of I/O so it
 * can be unit-tested against known fixtures (see scripts/test-balances.ts).
 *
 *   Net Disposable = Σ income − Σ deduction
 *   Remaining      = Net Disposable − Σ need − Σ investment
 *   Discretionary(planned) = Remaining − Σ giving − Σ savings   ("plug")
 *   Discretionary(actual)  = Σ actual discretionary transactions
 *   Unallocated    = Remaining − Σ giving − Σ savings − Discretionary(actual)
 */
export function computeBalances(
  categories: Category[],
  plannedByCat: Map<string, number>,
  actualByCat: Map<string, number>
): BalancesResult {
  const sum = (kind: CategoryKind, pick: "planned" | "actual"): number =>
    categories
      .filter((c) => c.kind === kind)
      .reduce(
        (acc, c) =>
          acc + (pick === "planned" ? plannedByCat.get(c.id) ?? 0 : actualByCat.get(c.id) ?? 0),
        0
      );

  const incomeP = sum("income", "planned"), incomeA = sum("income", "actual");
  const dedP = sum("deduction", "planned"), dedA = sum("deduction", "actual");
  const needP = sum("need", "planned"), needA = sum("need", "actual");
  const invP = sum("investment", "planned"), invA = sum("investment", "actual");
  const giveP = sum("giving", "planned"), giveA = sum("giving", "actual");
  const saveP = sum("savings", "planned"), saveA = sum("savings", "actual");
  const discA = sum("discretionary", "actual");

  const netDisposable = money(incomeP - dedP, incomeA - dedA);
  const remaining = money(
    netDisposable.planned - needP - invP,
    netDisposable.actual - needA - invA
  );
  const discretionary = money(remaining.planned - giveP - saveP, discA);
  const unallocated = money(0, remaining.actual - giveA - saveA - discA);

  const rows: BalanceRow[] = [];
  const pushCats = (kind: CategoryKind) => {
    for (const c of categories.filter((x) => x.kind === kind)) {
      const m = money(plannedByCat.get(c.id) ?? 0, actualByCat.get(c.id) ?? 0);
      rows.push({ type: "category", id: c.id, name: c.name, color: c.color, kind: c.kind, ...m });
    }
  };
  const derived = (key: string, label: string, m: Money): BalanceRow => ({
    type: "derived",
    key,
    label,
    ...m,
  });

  pushCats("income");
  pushCats("deduction");
  rows.push({ type: "spacer" });
  rows.push(derived("netDisposable", "Net Disposable", netDisposable));
  pushCats("need");
  pushCats("investment");
  rows.push({ type: "spacer" });
  rows.push(derived("remaining", "Remaining after expenses, needs, and savings", remaining));
  pushCats("giving");
  pushCats("savings");
  rows.push(derived("discretionary", "Monthly Discretionary Spend", discretionary));
  rows.push(derived("unallocated", "Unallocated (checking flow)", unallocated));

  return {
    rows,
    totals: {
      income: money(incomeP, incomeA),
      deduction: money(dedP, dedA),
      need: money(needP, needA),
      investment: money(invP, invA),
      giving: money(giveP, giveA),
      savings: money(saveP, saveA),
      netDisposable,
      remaining,
      discretionary,
      unallocated,
    },
  };
}
