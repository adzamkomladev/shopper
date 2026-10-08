import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
export async function boxDatabase(connectionString: string) {
  const client = new Client({ connectionString });
  await client.connect();
  return { db: drizzle(client, { schema }), close: () => client.end() };
}
