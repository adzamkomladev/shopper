import { fileURLToPath } from "node:url";
import { Client, escapeIdentifier } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../packages/db/pg/src/schemas";
import { migrateDatabase } from "./migrate";
import { e2eRun } from "../e2e/run";
import { provisionOrg, provisioningContext } from "./seed";

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  `postgresql://shopper:shopper_dev_only@127.0.0.1:5432/${e2eRun.database}`;
const SHOPS = [
  { name: "E2E Mart", slug: "e2e-mart" },
  { name: "E2E Annex", slug: "e2e-annex" },
];

/** Drops and recreates the e2e database, migrates it and provisions the two e2e shops. */
export async function resetE2eDatabase(url = E2E_DATABASE_URL) {
  await administer(url, (quoted) => [
    `DROP DATABASE IF EXISTS ${quoted} WITH (FORCE)`,
    `CREATE DATABASE ${quoted}`,
  ]);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const db = drizzle(client, { schema });
    await migrateDatabase(db);
    for (const shop of SHOPS) await provisionOrg(db, provisioningContext(), shop);
  } finally {
    await client.end();
  }
}

/** Drops the e2e database once its run is over. */
export async function dropE2eDatabase(url = E2E_DATABASE_URL) {
  await administer(url, (quoted) => [`DROP DATABASE IF EXISTS ${quoted} WITH (FORCE)`]);
}

async function administer(url: string, statements: (quoted: string) => string[]) {
  const target = new URL(url);
  const name = target.pathname.slice(1);
  assertDisposable(target, name);
  target.pathname = "/postgres";
  const admin = new Client({ connectionString: target.toString() });
  await admin.connect();
  try {
    for (const statement of statements(escapeIdentifier(name))) await admin.query(statement);
  } finally {
    await admin.end();
  }
}

// Dropping is irreversible: only an `*_e2e` database, and only a local one outside CI.
function assertDisposable(url: URL, name: string) {
  if (!/^[a-z0-9_]*_e2e$/.test(name))
    throw new Error(`Refusing to drop "${name}": not an *_e2e database`);
  if (!process.env.CI && !["localhost", "127.0.0.1"].includes(url.hostname))
    throw new Error(`Refusing to drop on ${url.hostname}: the e2e database must be local`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await resetE2eDatabase();
  console.log(`e2e database ready: ${SHOPS.map((shop) => shop.slug).join(", ")}`);
}
