import { CosmosClient, Container, Database } from "@azure/cosmos";

// Read env vars lazily (inside functions, not at module load time). Scripts like
// seed.ts populate process.env from local.settings.json *after* importing this module,
// so capturing them into module-level consts at import time would freeze in `undefined`.
let client: CosmosClient | null = null;

function getClient(): CosmosClient {
  if (!client) {
    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;
    if (!endpoint || !key) {
      throw new Error("Cosmos DB is not configured (COSMOS_ENDPOINT / COSMOS_KEY missing).");
    }
    client = new CosmosClient({ endpoint, key });
  }
  return client;
}

function getDatabaseId(): string {
  return process.env.COSMOS_DATABASE || "budgetier";
}

export function getDatabase(): Database {
  return getClient().database(getDatabaseId());
}

// Container definitions: id + partition key path.
export const CONTAINERS = {
  users: { id: "users", partitionKey: "/id" },
  categories: { id: "categories", partitionKey: "/id" },
  budgets: { id: "budgets", partitionKey: "/yearMonth" },
  transactions: { id: "transactions", partitionKey: "/yearMonth" },
  recurring: { id: "recurring", partitionKey: "/id" },
} as const;

export function container(name: keyof typeof CONTAINERS): Container {
  return getDatabase().container(CONTAINERS[name].id);
}

/**
 * Ensures the database and all containers exist. Used by the seed script and safe
 * to call repeatedly (idempotent). Requires an account with the free-tier throughput
 * or shared throughput available.
 */
export async function ensureSchema(): Promise<void> {
  const c = getClient();
  // Shared throughput at the database level (400 RU/s) so all four containers share
  // one bucket — this stays inside the Cosmos free-tier allotment (1000 RU/s free).
  const { database } = await c.databases.createIfNotExists({
    id: getDatabaseId(),
    throughput: 400,
  });
  for (const def of Object.values(CONTAINERS)) {
    // No per-container throughput → containers use the shared database throughput.
    await database.containers.createIfNotExists({
      id: def.id,
      partitionKey: { paths: [def.partitionKey] },
    });
  }
}
