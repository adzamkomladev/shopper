// The sealed box is one Bun executable: it migrates its own database, serves its own portal and runs its own backup,
// from a folder that holds nothing else.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { postgresFixture } from "../../fixtures/postgres";
import { rivetEngine, rivetPool } from "../../support/rivet/engine";
import { sealedBox, startSealed } from "../../support/box/sealed";

const secrets = {
  SHOPPER_AUTH_SECRET: "sealed-test-secret-0123456789abcdef",
  SHOPPER_EGRESS: "off",
};
let sealed: Awaited<ReturnType<typeof sealedBox>>;
const fixtures: Array<Awaited<ReturnType<typeof postgresFixture>>> = [];
const folders: string[] = [];

beforeAll(async () => {
  sealed = await sealedBox();
}, 300_000);
afterAll(async () => {
  await sealed?.close();
  await Promise.all(fixtures.map((fixture) => fixture.close()));
  await Promise.all(folders.map((folder) => rm(folder, { recursive: true, force: true })));
});

async function database() {
  const fixture = await postgresFixture();
  fixtures.push(fixture);
  return fixture.connectionString;
}
const journalLength = async () =>
  (
    JSON.parse(
      await readFile(
        new URL("../../../packages/db/pg/migrations/meta/_journal.json", import.meta.url),
        "utf8",
      ),
    ) as { entries: unknown[] }
  ).entries.length;
const config = (url: string, port: string) => ({
  ...secrets,
  DATABASE_URL: url,
  SHOPPER_AUTH_URL: `http://127.0.0.1:${port}`,
});

test("an empty database is migrated on start, and the portal comes out of the binary", async () => {
  const url = await database();
  const box = await startSealed(await sealed.install(), config(url, "3001"));
  try {
    const pool = new Pool({ connectionString: url });
    const { rows } = await pool.query(
      "select count(*)::int as n from drizzle.__drizzle_migrations",
    );
    expect(rows[0].n).toBe(await journalLength());
    await pool.end();

    const shell = await fetch(`${box.url}/stores/anything`, { headers: { accept: "text/html" } });
    expect(shell.status).toBe(200);
    expect(await shell.text()).toContain("<title>Sealed portal</title>");
    expect(shell.headers.get("x-frame-options")).toBe("DENY");
    const asset = await fetch(`${box.url}/assets/app-9f8e.js`);
    expect(asset.headers.get("content-type")).toContain("javascript");
    expect(await asset.text()).toBe("export const sealed = true;");
    for (const path of ["/%2e%2e/etc/passwd", "/assets/..%2f..%2fpayload.bin"]) {
      expect((await (await fetch(`${box.url}${path}`)).text()).includes("root:")).toBe(false);
    }
  } finally {
    await box.stop();
  }
}, 120_000);

test("a restart migrates nothing again, and an upgraded binary records the shop's new version once", async () => {
  const url = await database();
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });
  await migrateDatabase(db);
  const shop = provisioningContext();
  // Installed by an older binary: its meta row names a version this build is not.
  await provisionOrg(db, { ...shop, appVersion: "0.0.1" }, { name: "Upgraded shop", slug: "up" });
  const install = await sealed.install();
  // Started twice: the second start finds the row already there.
  for (let start = 0; start < 2; start += 1) {
    const box = await startSealed(install, config(url, "3001"));
    await box.stop();
    const { rows } = await pool.query(
      "select event, product_version from shopper_meta where org_id = $1 order by created_at",
      [shop.orgId],
    );
    expect(rows.map((row) => row.event)).toEqual(["install", "upgrade"]);
  }
  const { rows } = await pool.query(
    "select command from audit_log where org_id = $1 and command = 'org.record_upgrade'",
    [shop.orgId],
  );
  expect(rows).toHaveLength(1);
  await pool.end();
}, 120_000);

test("`shopper-box backup` is the Day 37 backup, run from the sealed binary", async () => {
  const url = await database();
  const pool = new Pool({ connectionString: url });
  await migrateDatabase(drizzle(pool, { schema }));
  const shop = provisioningContext();
  await provisionOrg(drizzle(pool, { schema }), shop, { name: "Backed up", slug: "bk" });
  await pool.end();
  const dir = await mkdtemp(join(tmpdir(), "sealed-backup-"));
  folders.push(dir);
  execFileSync("age-keygen", ["-o", join(dir, "identity.txt")], { stdio: "ignore" });
  const recipient = (await readFile(join(dir, "identity.txt"), "utf8")).match(/age1[0-9a-z]+/)![0];
  const install = await sealed.install();
  const out = execFileSync(install.binary, ["backup"], {
    cwd: install.home,
    env: {
      PATH: process.env.PATH ?? "",
      DATABASE_URL: url,
      SHOPPER_BACKUP_RECIPIENT: recipient,
      SHOPPER_BACKUP_REMOTE: join(dir, "remote"),
      SHOPPER_BACKUP_DIR: join(dir, "work"),
    },
  }).toString();
  expect(JSON.parse(out.trim().split("\n").at(-1)!)).toMatchObject({ event: "backup.uploaded" });
  expect(await readdir(join(dir, "remote"))).toHaveLength(1);
}, 120_000);

test("the Rivet runner runs inside the binary: doctor runs a workflow to its first step on the engine", async () => {
  const install = await sealed.install();
  const run = (env: Record<string, string>) =>
    execFileSync(install.binary, ["doctor"], {
      cwd: install.home,
      env: { PATH: process.env.PATH ?? "", ...env },
      timeout: 90_000,
    }).toString();
  expect(run({})).toContain('"engine":"in-process"');
  expect(
    run({
      RIVET_ENDPOINT: rivetEngine.endpoint,
      RIVET_TOKEN: rivetEngine.token,
      RIVET_POOL: rivetPool(),
    }),
  ).toContain('"engine":"rivet"');
}, 200_000);
