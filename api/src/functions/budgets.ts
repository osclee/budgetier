import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { container } from "../lib/cosmos";
import { Budget } from "../lib/types";
import { ok, withAuth } from "../lib/http";
import { budgetUpsertSchema, yearMonthSchema } from "../lib/validate";

const list = withAuth(async (request: HttpRequest): Promise<HttpResponseInit> => {
  const month = yearMonthSchema.parse(request.query.get("month"));
  const { resources } = await container("budgets")
    .items.query<Budget>({
      query: "SELECT * FROM c WHERE c.yearMonth = @m",
      parameters: [{ name: "@m", value: month }],
    })
    .fetchAll();
  return ok(resources);
});

const upsert = withAuth(async (request: HttpRequest): Promise<HttpResponseInit> => {
  const input = budgetUpsertSchema.parse(await request.json());
  const budget: Budget = {
    id: `${input.yearMonth}:${input.categoryId}`,
    yearMonth: input.yearMonth,
    categoryId: input.categoryId,
    planned: input.planned,
  };
  const { resource } = await container("budgets").items.upsert(budget);
  return ok(resource);
});

app.http("budgetsList", { methods: ["GET"], authLevel: "anonymous", route: "budgets", handler: list });
app.http("budgetsUpsert", { methods: ["PUT"], authLevel: "anonymous", route: "budgets", handler: upsert });
