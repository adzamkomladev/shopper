import { Client } from "pg";
import { v7 } from "uuid";

export function testOrg() {
  return { id: v7(), name: "Integration test store" };
}

export async function postgresFixture() {
  const connectionString =
    process.env.TEST_DATABASE_URL ?? "postgresql://shopper:shopper_dev_only@127.0.0.1:5432/shopper";
  const database = `shopper_test_${v7().replaceAll("-", "")}`;
  const admin = new Client({ connectionString });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`);
  const url = new URL(connectionString);
  url.pathname = `/${database}`;
  const client = new Client({ connectionString: url.toString() });
  try {
    await client.connect();
  } catch (error) {
    await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await admin.end();
    throw error;
  }
  return {
    connectionString: url.toString(),
    client,
    async close() {
      try {
        await client.end();
        // pool.end() resolves before its sockets close; a forced drop would kill those
        // backends mid-disconnect and surface as an unhandled client error. Let them drain.
        for (let waited = 0; waited < 5000; waited += 50) {
          const open = await admin.query(
            "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = $1",
            [database],
          );
          if (open.rows[0].n === 0) break;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
      } finally {
        await admin.end();
      }
    },
  };
}
