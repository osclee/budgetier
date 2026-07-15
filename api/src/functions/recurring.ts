import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { randomUUID } from "crypto";
import { container } from "../lib/cosmos";
import { RecurringTransaction, Transaction } from "../lib/types";
import { badRequest, notFound, ok, withAuth } from "../lib/http";
import { recurringApplySchema, recurringCreateSchema, recurringUpdateSchema } from "../lib/validate";
import { clampDayOfMonth } from "../lib/date";

const list = withAuth(async (): Promise<HttpResponseInit> => {
  const { resources } = await container("recurring")
    .items.query<RecurringTransaction>("SELECT * FROM c ORDER BY c.dayOfMonth")
    .fetchAll();
  return ok(resources);
});

const create = withAuth(async (request: HttpRequest): Promise<HttpResponseInit> => {
  const input = recurringCreateSchema.parse(await request.json());
  const recurring: RecurringTransaction = { id: randomUUID(), ...input };
  const { resource } = await container("recurring").items.create(recurring);
  return { status: 201, jsonBody: resource };
});

const update = withAuth(async (request: HttpRequest): Promise<HttpResponseInit> => {
  const id = request.params.id;
  if (!id) return badRequest("Missing id");
  const patch = recurringUpdateSchema.parse(await request.json());

  const { resources } = await container("recurring")
    .items.query<RecurringTransaction>({
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: id }],
    })
    .fetchAll();
  const existing = resources[0];
  if (!existing) return notFound("Recurring transaction not found");

  const updated: RecurringTransaction = { ...existing, ...patch, id: existing.id };
  const { resource } = await container("recurring").item(id, id).replace(updated);
  return ok(resource);
});

const remove = withAuth(async (request: HttpRequest): Promise<HttpResponseInit> => {
  const id = request.params.id;
  if (!id) return badRequest("Missing id");
  try {
    await container("recurring").item(id, id).delete();
  } catch (err: any) {
    if (err?.code === 404) return notFound("Recurring transaction not found");
    throw err;
  }
  return ok({ ok: true });
});

/**
 * Materializes every active recurring template into real transactions for `yearMonth`,
 * skipping templates that already have a matching transaction (via `recurringId`) so
 * this is safe to call repeatedly (e.g. a second click just applies newly-added templates).
 */
const apply = withAuth(async (request: HttpRequest): Promise<HttpResponseInit> => {
  const { yearMonth } = recurringApplySchema.parse(await request.json());

  const [templatesRes, existingTxRes] = await Promise.all([
    container("recurring")
      .items.query<RecurringTransaction>("SELECT * FROM c WHERE c.active = true")
      .fetchAll(),
    container("transactions")
      .items.query<Transaction>({
        query: "SELECT * FROM c WHERE c.yearMonth = @m",
        parameters: [{ name: "@m", value: yearMonth }],
      })
      .fetchAll(),
  ]);

  const alreadyApplied = new Set(
    existingTxRes.resources.filter((t) => t.recurringId).map((t) => t.recurringId)
  );
  const toApply = templatesRes.resources.filter((t) => !alreadyApplied.has(t.id));

  const created = await Promise.all(
    toApply.map(async (t) => {
      const tx: Transaction = {
        id: randomUUID(),
        yearMonth,
        date: clampDayOfMonth(yearMonth, t.dayOfMonth),
        description: t.description,
        amount: t.amount,
        categoryId: t.categoryId,
        recurringId: t.id,
      };
      const { resource } = await container("transactions").items.create(tx);
      return resource;
    })
  );

  return ok({ created, skipped: templatesRes.resources.length - toApply.length });
});

app.http("recurringList", { methods: ["GET"], authLevel: "anonymous", route: "recurring", handler: list });
app.http("recurringCreate", { methods: ["POST"], authLevel: "anonymous", route: "recurring", handler: create });
app.http("recurringUpdate", { methods: ["PUT"], authLevel: "anonymous", route: "recurring/{id}", handler: update });
app.http("recurringDelete", { methods: ["DELETE"], authLevel: "anonymous", route: "recurring/{id}", handler: remove });
app.http("recurringApply", { methods: ["POST"], authLevel: "anonymous", route: "recurring/apply", handler: apply });
