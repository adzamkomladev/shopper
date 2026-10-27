import { Socket } from "node:net";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";

// The configured nodejs_compat target supports outbound net.Socket. Supplying it
// avoids pg-cloudflare's reader rejecting after an otherwise clean client.end().
export async function cloudflareDatabase(connectionString: string) {
  const client = new Client({ connectionString, stream: () => new Socket() });
  await client.connect();
  return { db: drizzle(client, { schema }), close: () => client.end() };
}

/** A workflow's `withDatabase`: one Hyperdrive connection per call, closed when the call settles. */
export function hyperdriveDatabase(hyperdrive: Hyperdrive) {
  return async <T>(
    run: (db: Awaited<ReturnType<typeof cloudflareDatabase>>["db"]) => Promise<T>,
  ) => {
    const connection = await cloudflareDatabase(hyperdrive.connectionString);
    try {
      return await run(connection.db);
    } finally {
      await connection.close();
    }
  };
}
