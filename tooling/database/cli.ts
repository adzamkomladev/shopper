import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../packages/db/pg/src/schemas";
import { migrateDatabase } from "./migrate";
import { seedCatalogue, seedDevelopment } from "./seed";
import { PLATFORM_ORG, seedPlatform } from "./platform";
import { credentialsTable, SEED_PASSWORD, seedDemo } from "./demo";
import { assertWritable, resetSchemas } from "./reset";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { confirm: { type: "string" }, products: { type: "string", default: "20000" } },
});
const action = positionals[0];
if (action !== "migrate" && action !== "seed" && action !== "reset")
  throw new Error(
    "Usage: db:migrate, db:seed or db:reset [--products N] [--confirm <remote host>]",
  );
const url =
  process.env.DATABASE_URL ??
  process.env.TEST_DATABASE_URL ??
  "postgresql://shopper:shopper_dev_only@127.0.0.1:5432/shopper";
const products = Number(values.products);
if (!Number.isSafeInteger(products) || products < 0) throw new Error("--products must be >= 0");
if (action !== "migrate") {
  try {
    const { host, database } = assertWritable(url, values.confirm, process.env.SHOPPER_ENVIRONMENT);
    console.log(
      `${action === "reset" ? "Resetting" : "Seeding"} database "${database}" on ${host}`,
    );
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}
const client = new Client({ connectionString: url });
try {
  await client.connect();
  const db = drizzle(client, { schema });
  if (action === "reset") await resetSchemas(db);
  if (action !== "seed") await migrateDatabase(db);
  if (action === "migrate") console.log("Schema migrations applied successfully.");
  else {
    const seeded = await seedDevelopment(db);
    if (!seeded.created) console.log("Already seeded: run db:reset to start over.");
    else {
      const catalogue = await seedCatalogue(db, seeded.id, products);
      console.log({ catalogue: { created: catalogue.created, rowsFailed: catalogue.rowsFailed } });
      const staffEmail = "staff@shopper.local";
      await seedPlatform(db, staffEmail, SEED_PASSWORD);
      const table = credentialsTable([
        ...(await seedDemo(db, seeded.id)),
        { org: PLATFORM_ORG, role: "platform staff (admin app, :5187)", email: staffEmail },
      ]);
      mkdirSync(".shopper/seed", { recursive: true });
      writeFileSync(".shopper/seed/credentials.md", table);
      console.log(table);
    }
  }
} finally {
  await client.end();
}
