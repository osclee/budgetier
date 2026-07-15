import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { container } from "../lib/cosmos";
import { Budget, Category, Transaction } from "../lib/types";
import { ok, withAuth } from "../lib/http";
import { insightsMonthsSchema } from "../lib/validate";
import { today, computeWindow } from "../lib/date";
import { computeInsights } from "../lib/insights-compute";

const insights = withAuth(async (request: HttpRequest): Promise<HttpResponseInit> => {
  const months = insightsMonthsSchema.parse(request.query.get("months") ?? undefined);
  const todayStr = today();
  const { start, end } = computeWindow(todayStr, months);

  const [catsRes, budgetsRes, txRes] = await Promise.all([
    container("categories").items.query<Category>("SELECT * FROM c ORDER BY c.sortOrder").fetchAll(),
    container("budgets")
      .items.query<Budget>({
        query: "SELECT * FROM c WHERE c.yearMonth >= @start AND c.yearMonth <= @end",
        parameters: [{ name: "@start", value: start }, { name: "@end", value: end }],
      })
      .fetchAll(),
    container("transactions")
      .items.query<Transaction>({
        query: "SELECT * FROM c WHERE c.yearMonth >= @start AND c.yearMonth <= @end",
        parameters: [{ name: "@start", value: start }, { name: "@end", value: end }],
      })
      .fetchAll(),
  ]);

  // "Invested" includes any investment-kind category PLUS any category explicitly
  // flagged countsAsInvestment (e.g. 401k, which is kind: "deduction" for the Balances
  // cash-flow math but is still real investing) — see Category.countsAsInvestment.
  const investCategoryIds = new Set(
    catsRes.resources.filter((c) => c.kind === "investment" || c.countsAsInvestment).map((c) => c.id)
  );
  const saveCategoryIds = new Set(
    catsRes.resources.filter((c) => c.kind === "savings").map((c) => c.id)
  );
  const investSaveIds = [...investCategoryIds, ...saveCategoryIds];

  const allTimeRes = investSaveIds.length
    ? await container("transactions")
        .items.query<{ amount: number; categoryId: string }>({
          query: "SELECT c.amount, c.categoryId FROM c WHERE ARRAY_CONTAINS(@ids, c.categoryId)",
          parameters: [{ name: "@ids", value: investSaveIds }],
        })
        .fetchAll()
    : { resources: [] as { amount: number; categoryId: string }[] };

  let allTimeInvestedActual = 0;
  let allTimeSavedActual = 0;
  for (const t of allTimeRes.resources) {
    if (investCategoryIds.has(t.categoryId)) allTimeInvestedActual += t.amount;
    if (saveCategoryIds.has(t.categoryId)) allTimeSavedActual += t.amount;
  }

  const result = computeInsights({
    months,
    today: todayStr,
    categories: catsRes.resources,
    transactions: txRes.resources,
    budgets: budgetsRes.resources,
    allTimeInvestedActual,
    allTimeSavedActual,
  });

  return ok(result);
});

app.http("insightsGet", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "insights",
  handler: insights,
});
