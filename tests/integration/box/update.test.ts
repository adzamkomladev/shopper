// Update bundles: signed by Shopper, covered by the licence's maintenance date, backed up first, unpacked into the spare slot.
import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { appendFile, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { BoxUpdateError } from "@shopper/api";
import * as schema from "@shopper/db-pg";
import { memoryLaunch } from "@shopper/adapters-box";
import { generateKey } from "@shopper/core/licence";
import { boxUpdates } from "@shopper/box";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { postgresFixture } from "../../fixtures/postgres";
import { boxTree, bundle } from "../../support/box/updates";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let shopper: Awaited<ReturnType<typeof generateKey>>;
let org: string;
const installed = { version: "1.0.0", schemaVersion: 41 };

beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  const db = drizzle(pool, { schema });
  await migrateDatabase(db);
  const shop = provisioningContext();
  org = shop.orgId;
  await provisionOrg(db, shop, { name: "Updates", slug: "upd" });
  shopper = await generateKey();
}, 120_000);
afterAll(async () => {
  await pool?.end();
  await fixture?.close();
});

async function service(
  maintenanceUntil: string | undefined = "2026-12-01",
  backup = vi.fn(async () => {}),
) {
  const tree = await boxTree();
  const db = drizzle(pool, { schema });
  const updates = boxUpdates({
    env: { SHOPPER_UPDATES_DIR: tree.updates, SHOPPER_SLOTS_DIR: tree.root },
    releaseKey: shopper.publicKey,
    installed,
    maintenanceUntil: async () => maintenanceUntil,
    backup,
    withDatabase: (run) => run(db),
    launch: memoryLaunch,
  });
  return { ...tree, updates: tree.updates, service: updates, backup };
}
const who = () => ({ orgId: org });
const refusal = async (run: Promise<unknown>) =>
  (await run.catch((error: unknown) => error)) as BoxUpdateError;
const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

test("a bundle is judged by the day it was built against the licence's updates date", async () => {
  const t = await service("2026-12-01");
  await bundle(t.updates, "ok.tgz", shopper.privateKey);
  await bundle(t.updates, "late.tgz", shopper.privateKey, {
    builtAt: "2027-01-05T08:00:00.000Z",
    version: "1.2.0",
  });
  const stranger = await generateKey();
  await bundle(t.updates, "forged.tgz", stranger.privateKey, { version: "1.3.0" });
  const overview = await t.service.overview();
  expect(overview.running).toEqual({ version: "1.0.0", slot: "a" });
  // Only bundles Shopper signed are listed, newest first.
  expect(overview.bundles.map((each) => each.file)).toEqual(["late.tgz", "ok.tgz"]);
  expect(overview.bundles[1]!.verdict).toEqual({ ok: true });
  expect(overview.bundles[0]!.verdict).toMatchObject({
    ok: false,
    reason: "maintenance",
    message: expect.stringContaining("built on 5 Jan 2027, after your updates ended on 1 Dec 2026"),
  });
  expect((await refusal(t.service.install("late.tgz", who()))).status).toBe(422);
  expect(await exists(join(t.root, "slots", "b"))).toBe(false);
  expect(await exists(join(t.updates, "apply.json"))).toBe(false);
});

test("install: backup first, then the spare slot holds exactly the signed files and the root helper is asked to switch", async () => {
  const t = await service();
  await bundle(t.updates, "ok.tgz", shopper.privateKey);
  await t.service.install("ok.tgz", who());
  expect(t.backup).toHaveBeenCalledOnce();
  expect(await readFile(join(t.root, "slots", "b", "shopper-box"), "utf8")).toBe("box 1.1.0");
  expect(JSON.parse(await readFile(join(t.updates, "apply.json"), "utf8"))).toEqual({
    slot: "b",
    version: "1.1.0",
    file: "ok.tgz",
  });
  // The running slot is untouched, and a second request waits for the first.
  expect(await readFile(join(t.root, "slots", "a", "shopper-box"), "utf8")).toBe("box 1.0.0");
  expect((await refusal(t.service.install("ok.tgz", who()))).status).toBe(409);
  const { rows } = await pool.query(
    "select command from audit_log where org_id = $1 and command = 'box.update.run'",
    [org],
  );
  expect(rows.length).toBeGreaterThan(0);
});

test("a failed backup, a changed file and a bundle that is not an update leave the spare slot and the request alone", async () => {
  const failing = await service(
    "2026-12-01",
    vi.fn(async () => Promise.reject(new Error("backups are not set up on this box"))),
  );
  await bundle(failing.updates, "ok.tgz", shopper.privateKey);
  const stopped = await refusal(failing.service.install("ok.tgz", who()));
  expect(stopped.status).toBe(409);
  expect(stopped.message).toContain("verified backup first");
  expect(await exists(join(failing.root, "slots", "b"))).toBe(false);

  const t = await service();
  // Signed, then one file changed before the bundle was packed again: the manifest no longer matches it.
  const source = await bundle(t.updates, "ok.tgz", shopper.privateKey);
  await appendFile(join(source, "engine", "rivet-engine"), "!");
  execFileSync("tar", ["-czf", join(t.updates, "ok.tgz"), "-C", source, "."]);
  const changed = await refusal(t.service.install("ok.tgz", who()));
  expect(changed.message).toBe("engine/rivet-engine is not what Shopper signed.");
  expect(await readdir(join(t.root, "slots")).then((names) => names.includes("b"))).toBe(false);
  expect(await exists(join(t.updates, "apply.json"))).toBe(false);

  await bundle(t.updates, "tax.tgz", shopper.privateKey, {
    kind: "taxpack",
    builtAt: "2027-03-01T00:00:00.000Z",
  });
  expect((await refusal(t.service.install("tax.tgz", who()))).message).toMatch(/tax rule pack/);
  // A name is a file name, never a path.
  expect((await refusal(t.service.install("../../etc/passwd", who()))).status).toBe(400);
});

test("scheduled after closing: it waits, installs once at its time, and cancelling leaves it uninstalled", async () => {
  const t = await service();
  await bundle(t.updates, "ok.tgz", shopper.privateKey);
  const at = new Date(Date.now() + 1500).toISOString();
  await t.service.schedule("ok.tgz", at, who());
  expect((await t.service.overview()).scheduled).toEqual({ file: "ok.tgz", at });
  expect(
    (await refusal(t.service.schedule("ok.tgz", new Date(Date.now() - 1000).toISOString(), who())))
      .status,
  ).toBe(422);
  await expect.poll(() => exists(join(t.updates, "apply.json")), { timeout: 20_000 }).toBe(true);
  expect(t.backup).toHaveBeenCalledOnce();
  expect((await t.service.overview()).scheduled).toBeUndefined();

  const later = await service();
  await bundle(later.updates, "ok.tgz", shopper.privateKey);
  await later.service.schedule("ok.tgz", new Date(Date.now() + 1500).toISOString(), who());
  await later.service.cancel();
  await new Promise((resolve) => setTimeout(resolve, 4000));
  expect(await exists(join(later.updates, "apply.json"))).toBe(false);
  expect(later.backup).not.toHaveBeenCalled();
}, 60_000);
