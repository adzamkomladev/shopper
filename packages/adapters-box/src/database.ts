import { Client, Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
export async function boxDatabase(connectionString: string) {
  const client = new Client({ connectionString });
  await client.connect();
  return { db: drizzle(client, { schema }), close: () => client.end() };
}
// Long-lived pool for work that outlives a request, such as workflows.
export function boxPool(connectionString: string) {
  const pool = new Pool({ connectionString, max: 4 });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}
