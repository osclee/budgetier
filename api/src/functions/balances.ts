import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { container } from "../lib/cosmos";
import { Budget, Category, Transaction } from "../lib/types";
import { ok, withAuth } from "../lib/http";
import { yearMonthSchema } from "../lib/validate";
import { computeBalances } from "../lib/balances-compute";

const balances = withAuth(async (request: HttpRequest): Promise<HttpResponseInit> => {
  const month = yearMonthSchema.parse(request.query.get("month"));

  const [catsRes, budgetsRes, txRes] = await Promise.all([
    container("categories").items.query<Category>("SELECT * FROM c ORDER BY c.sortOrder").fetchAll(),
    container("budgets")
      .items.query<Budget>({
        query: "SELECT * FROM c WHERE c.yearMonth = @m",
        parameters: [{ name: "@m", value: month }],
      })
      .fetchAll(),
    container("transactions")
      .items.query<Transaction>({
        query: "SELECT * FROM c WHERE c.yearMonth = @m",
        parameters: [{ name: "@m", value: month }],
      })
      .fetchAll(),
  ]);

  const plannedByCat = new Map<string, number>();
  for (const b of budgetsRes.resources) plannedByCat.set(b.categoryId, b.planned);
  const actualByCat = new Map<string, number>();
  for (const t of txRes.resources) {
    actualByCat.set(t.categoryId, (actualByCat.get(t.categoryId) ?? 0) + t.amount);
  }

  const { rows, totals } = computeBalances(catsRes.resources, plannedByCat, actualByCat);
  return ok({ month, rows, totals });
});

app.http("balancesGet", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "balances",
  handler: balances,
});
