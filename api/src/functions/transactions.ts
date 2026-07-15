import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { randomUUID } from "crypto";
import { container } from "../lib/cosmos";
import { Transaction } from "../lib/types";
import { badRequest, notFound, ok, withAuth } from "../lib/http";
import {
  transactionCreateSchema,
  transactionUpdateSchema,
  yearMonthOf,
  yearMonthSchema,
} from "../lib/validate";

async function getById(id: string): Promise<Transaction | null> {
  const { resources } = await container("transactions")
    .items.query<Transaction>({
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: id }],
    })
    .fetchAll();
  return resources[0] ?? null;
}

const list = withAuth(async (request: HttpRequest): Promise<HttpResponseInit> => {
  const month = yearMonthSchema.parse(request.query.get("month"));
  const { resources } = await container("transactions")
    .items.query<Transaction>({
      query: "SELECT * FROM c WHERE c.yearMonth = @m ORDER BY c.date DESC",
      parameters: [{ name: "@m", value: month }],
    })
    .fetchAll();
  return ok(resources);
});

const create = withAuth(async (request: HttpRequest): Promise<HttpResponseInit> => {
  const input = transactionCreateSchema.parse(await request.json());
  const tx: Transaction = {
    id: randomUUID(),
    yearMonth: yearMonthOf(input.date),
    ...input,
  };
  const { resource } = await container("transactions").items.create(tx);
  return { status: 201, jsonBody: resource };
});

const update = withAuth(async (request: HttpRequest): Promise<HttpResponseInit> => {
  const id = request.params.id;
  if (!id) return badRequest("Missing id");
  const patch = transactionUpdateSchema.parse(await request.json());

  const existing = await getById(id);
  if (!existing) return notFound("Transaction not found");

  const merged: Transaction = { ...existing, ...patch, id: existing.id };
  merged.yearMonth = yearMonthOf(merged.date);

  if (merged.yearMonth === existing.yearMonth) {
    const { resource } = await container("transactions")
      .item(id, existing.yearMonth)
      .replace(merged);
    return ok(resource);
  }

  // Date moved to a different month → move across partitions (delete + recreate).
  await container("transactions").item(id, existing.yearMonth).delete();
  const { resource } = await container("transactions").items.create(merged);
  return ok(resource);
});

const remove = withAuth(async (request: HttpRequest): Promise<HttpResponseInit> => {
  const id = request.params.id;
  if (!id) return badRequest("Missing id");
  const existing = await getById(id);
  if (!existing) return notFound("Transaction not found");
  await container("transactions").item(id, existing.yearMonth).delete();
  return ok({ ok: true });
});

app.http("transactionsList", { methods: ["GET"], authLevel: "anonymous", route: "transactions", handler: list });
app.http("transactionsCreate", { methods: ["POST"], authLevel: "anonymous", route: "transactions", handler: create });
app.http("transactionsUpdate", { methods: ["PUT"], authLevel: "anonymous", route: "transactions/{id}", handler: update });
app.http("transactionsDelete", { methods: ["DELETE"], authLevel: "anonymous", route: "transactions/{id}", handler: remove });
