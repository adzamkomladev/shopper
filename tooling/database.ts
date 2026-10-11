import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../packages/db-pg/src/schema";
import { migrateDatabase } from "./migrate";
import { seedCatalogue, seedDevelopment } from "./seed";

const action = process.argv[2];
if (action !== "migrate" && action !== "seed") throw new Error("Usage: db:migrate or db:seed");
const client = new Client({
  connectionString:
    process.env.DATABASE_URL ?? "postgresql://shopper:shopper_dev_only@127.0.0.1:5432/shopper",
});
try {
  await client.connect();
  const db = drizzle(client, { schema });
  if (action === "migrate") {
    await migrateDatabase(db);
    console.log("Schema migrations applied successfully.");
  } else {
    const seeded = await seedDevelopment(db);
    const catalogue = seeded.created ? await seedCatalogue(db, seeded.id) : null;
    console.log({
      ...seeded,
      catalogue: catalogue
        ? { created: catalogue.created, rowsFailed: catalogue.rowsFailed }
        : "already seeded",
    });
  }
} finally {
  await client.end();
}
