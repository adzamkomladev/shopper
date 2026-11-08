// Notion Day 39 drill: lapsed maintenance. The box's updates ended, so an update built since is refused with both
// dates, but a tax rule pack is always applied: a rate change never waits on a renewal. A pack is applied at once
// (audited, and on to the tills through the same publish as an edited rule), and applying it again changes nothing. A pack that would rewrite a day already in
// force, or whose rules are not what Shopper signed, changes nothing.
import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import { and, eq } from "drizzle-orm";
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
beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  await migrateDatabase(drizzle(pool, { schema }));
  const shop = provisioningContext();
  org = shop.orgId;
  await provisionOrg(drizzle(pool, { schema }), shop, { name: "Lapsed", slug: "lapsed" });
  shopper = await generateKey();
}, 120_000);
afterAll(async () => {
  await pool?.end();
  await fixture?.close();
});

const db = () => drizzle(pool, { schema });
const rule = (effectiveFrom: string, vatBps = 1500) => ({
  effectiveFrom,
  vatBps,
  nhilBps: 250,
  getfundBps: 250,
  covidBps: 0,
  source: "GRA rate notice 2027/1",
});
const refusal = async (run: Promise<unknown>) =>
  (await run.catch((error: unknown) => error)) as BoxUpdateError;
const rules = () => db().select().from(schema.taxRule).where(eq(schema.taxRule.orgId, org));
const applied = () =>
  db()
    .select()
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.orgId, org), eq(schema.auditLog.command, "tax.pack.apply")));

test("updates ended: an update is refused with both dates, a tax rule pack is applied once", async () => {
  const tree = await boxTree();
  const backup = vi.fn(async () => {});
  const updates = boxUpdates({
    env: { SHOPPER_UPDATES_DIR: tree.updates, SHOPPER_SLOTS_DIR: tree.root },
    releaseKey: shopper.publicKey,
    installed: { version: "1.0.0", schemaVersion: 41 },
    maintenanceUntil: async () => "2026-01-31",
    backup,
    withDatabase: (run) => run(db()),
    launch: memoryLaunch,
  });
  const who = { orgId: org };
  await bundle(tree.updates, "update.tgz", shopper.privateKey);
  const refused = await refusal(updates.install("update.tgz", who));
  expect(refused.status).toBe(422);
  expect(refused.message).toBe(
    "This update was built on 10 Nov 2026, after your updates ended on 31 Jan 2026. Renew support to install it.",
  );

  await bundle(tree.updates, "tax.tgz", shopper.privateKey, {
    kind: "taxpack",
    files: { "taxrules.json": JSON.stringify([rule("2027-01-01")]) },
  });
  const before = (await rules()).length;
  expect(await updates.install("tax.tgz", who)).toEqual({ kind: "taxpack", applied: 1 });
  expect((await rules()).find((row) => row.effectiveFrom === "2027-01-01")).toMatchObject({
    vatBps: 1500,
    source: "GRA rate notice 2027/1",
  });
  expect(await applied()).toHaveLength(1);
  // Applying it again changes nothing; no backup or slot is ever involved.
  expect(await updates.install("tax.tgz", who)).toEqual({ kind: "taxpack", applied: 0 });
  expect(await rules()).toHaveLength(before + 1);
  expect(backup).not.toHaveBeenCalled();
  // A pack is applied at once: there is nothing to schedule after closing.
  expect((await refusal(updates.schedule("tax.tgz", "2099-01-01T00:00:00.000Z", who))).status).toBe(
    422,
  );

  // A rule for a day already in force is history: the whole pack is refused and nothing changes.
  await bundle(tree.updates, "past.tgz", shopper.privateKey, {
    kind: "taxpack",
    files: { "taxrules.json": JSON.stringify([rule("2027-02-01"), rule("2026-01-01", 1250)]) },
  });
  expect((await refusal(updates.install("past.tgz", who))).message).toBe(
    "A rule must start after today",
  );
  expect(await rules()).toHaveLength(before + 1);

  // Rules changed after Shopper signed them are refused before anything is read into the shop.
  const source = await bundle(tree.updates, "forged.tgz", shopper.privateKey, {
    kind: "taxpack",
    files: { "taxrules.json": JSON.stringify([rule("2027-03-01")]) },
  });
  await writeFile(join(source, "taxrules.json"), JSON.stringify([rule("2027-03-01", 0)]));
  execFileSync("tar", ["-czf", join(tree.updates, "forged.tgz"), "-C", source, "."]);
  expect((await refusal(updates.install("forged.tgz", who))).message).toBe(
    "taxrules.json is not what Shopper signed.",
  );
  // A genuine pack signed with no rules, and rules slipped in beside it: Shopper never signed them.
  const empty = await bundle(tree.updates, "added.tgz", shopper.privateKey, {
    kind: "taxpack",
    files: {},
  });
  await writeFile(join(empty, "taxrules.json"), JSON.stringify([rule("2027-03-01", 0)]));
  execFileSync("tar", ["-czf", join(tree.updates, "added.tgz"), "-C", empty, "."]);
  expect((await refusal(updates.install("added.tgz", who))).message).toBe(
    "taxrules.json is not what Shopper signed.",
  );
  expect(await rules()).toHaveLength(before + 1);
});
