import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { randomUUID } from "crypto";
import { container } from "../lib/cosmos";
import { Category } from "../lib/types";
import { badRequest, notFound, ok, withAuth } from "../lib/http";
import { categoryCreateSchema, categoryUpdateSchema } from "../lib/validate";

const list = withAuth(async (): Promise<HttpResponseInit> => {
  const { resources } = await container("categories")
    .items.query<Category>("SELECT * FROM c ORDER BY c.sortOrder")
    .fetchAll();
  return ok(resources);
});

const create = withAuth(async (request: HttpRequest): Promise<HttpResponseInit> => {
  const input = categoryCreateSchema.parse(await request.json());
  const category: Category = { id: randomUUID(), ...input };
  const { resource } = await container("categories").items.create(category);
  return { status: 201, jsonBody: resource };
});

const update = withAuth(async (request: HttpRequest): Promise<HttpResponseInit> => {
  const id = request.params.id;
  if (!id) return badRequest("Missing id");
  const patch = categoryUpdateSchema.parse(await request.json());

  const { resources } = await container("categories")
    .items.query<Category>({
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: id }],
    })
    .fetchAll();
  const existing = resources[0];
  if (!existing) return notFound("Category not found");

  const updated: Category = { ...existing, ...patch, id: existing.id };
  const { resource } = await container("categories").item(id, id).replace(updated);
  return ok(resource);
});

const remove = withAuth(async (request: HttpRequest): Promise<HttpResponseInit> => {
  const id = request.params.id;
  if (!id) return badRequest("Missing id");
  try {
    await container("categories").item(id, id).delete();
  } catch (err: any) {
    if (err?.code === 404) return notFound("Category not found");
    throw err;
  }
  return ok({ ok: true });
});

app.http("categoriesList", { methods: ["GET"], authLevel: "anonymous", route: "categories", handler: list });
app.http("categoriesCreate", { methods: ["POST"], authLevel: "anonymous", route: "categories", handler: create });
app.http("categoriesUpdate", { methods: ["PUT"], authLevel: "anonymous", route: "categories/{id}", handler: update });
app.http("categoriesDelete", { methods: ["DELETE"], authLevel: "anonymous", route: "categories/{id}", handler: remove });
