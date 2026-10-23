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
  // An idle client dies when the server restarts or drops the database. The pool discards it and connects
  // afresh on next use; without a listener Node treats the event as an uncaught exception.
  pool.on("error", (error) => console.error({ event: "database.pool_idle_error", error }));
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}
