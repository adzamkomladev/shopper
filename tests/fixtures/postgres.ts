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
        await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
      } finally {
        await admin.end();
      }
    },
  };
}
