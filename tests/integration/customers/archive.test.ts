import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { asc, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { verifyChain, type AuditEntry } from "@shopper/audit";
import { auditLog } from "@shopper/db-pg";
import { goldenWorld } from "../../support/sales/golden/setup";
import { ids } from "../../fixtures/sales/golden";
import { databases } from "../../support/till/server";
import { portalMember, portalOwner, type Portal } from "../../support/api/portal";
import { customerApi } from "../../support/customers/http";
import {
  addCreditEntry,
  addCustomer,
  addHold,
  addLoyaltyEntry,
} from "../../support/customers/seed";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let admin: ReturnType<typeof customerApi>;
let cashier: ReturnType<typeof customerApi>;
let accountant: ReturnType<typeof customerApi>;

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  admin = customerApi(owner, owner.cookie);
  cashier = customerApi(owner, await portalMember(owner, "cashier"));
  accountant = customerApi(owner, await portalMember(owner, "accountant"));
});
afterAll(async () => {
  await world?.local.close();
});

const idsOf = (page: { body: Record<string, any> }) =>
  page.body.items.map((c: { id: string }) => c.id);

test("an archived customer leaves the default list, shows under the archived filter and comes back on unarchive", async () => {
  const mark = `Arc${v7().slice(-6)}`;
  const id = await addCustomer({ name: `${mark} Kojo` });
  expect(idsOf(await admin.list(`q=${mark}`))).toEqual([id]);

  const archived = await admin.archive(id);
  expect(archived.status).toBe(200);
  expect(archived.body.archivedAt).toEqual(expect.any(String));
  expect(idsOf(await admin.list(`q=${mark}`))).toEqual([]);
  expect(idsOf(await admin.list(`q=${mark}&archived=1`))).toEqual([id]);
  expect((await admin.read(id)).body.archivedAt).toEqual(expect.any(String));

  const restored = await admin.unarchive(id);
  expect(restored.status).toBe(200);
  expect(restored.body.archivedAt).toBeNull();
  expect(idsOf(await admin.list(`q=${mark}`))).toEqual([id]);
  expect(idsOf(await admin.list(`q=${mark}&archived=1`))).toEqual([]);

  const log = await databases()
    .db.select()
    .from(auditLog)
    .where(eq(auditLog.orgId, ids.org))
    .orderBy(asc(auditLog.chainSeq));
  expect(
    log.filter((row) => row.entityId === id && row.entity === "customer").map((r) => r.command),
  ).toEqual(["customer.archive", "customer.unarchive"]);
  expect(await verifyChain(log as AuditEntry[])).toMatchObject({ valid: true });
});

test("archive and unarchive need customer.manage: the accountant may, the cashier may not", async () => {
  const id = await addCustomer();
  expect((await cashier.archive(id)).status).toBe(403);
  expect((await admin.read(id)).body.archivedAt).toBeNull();
  expect((await accountant.archive(id)).status).toBe(200);
  expect((await cashier.unarchive(id)).status).toBe(403);
  expect((await accountant.unarchive(id)).status).toBe(200);
  expect((await admin.archive(v7())).status).toBe(404);
});

test("archive is refused with 409 while the credit balance is not zero, owed or deposited", async () => {
  const owing = await addCustomer();
  await addCreditEntry(owing, "charge", 50_000);
  const refused = await admin.archive(owing);
  expect(refused.status).toBe(409);
  expect(refused.body.code).toBe("BALANCE_NOT_ZERO");
  expect((await admin.read(owing)).body.archivedAt).toBeNull();

  const deposit = await addCustomer();
  await addCreditEntry(deposit, "payment", -20_000);
  expect((await admin.archive(deposit)).body.code).toBe("BALANCE_NOT_ZERO");

  // The balance is a fold: a payment that settles the charge makes the archive legal.
  await addCreditEntry(owing, "payment", -50_000);
  expect((await admin.archive(owing)).status).toBe(200);
});

test("archive is refused with 409 while points are not zero, and allowed once they fold to zero", async () => {
  const id = await addCustomer();
  await addLoyaltyEntry(id, "earn", 40);
  const refused = await admin.archive(id);
  expect(refused.status).toBe(409);
  expect(refused.body.code).toBe("POINTS_NOT_ZERO");
  await addLoyaltyEntry(id, "redeem", -15);
  expect((await admin.archive(id)).body.code).toBe("POINTS_NOT_ZERO");
  await addLoyaltyEntry(id, "expire", -25);
  expect((await admin.archive(id)).status).toBe(200);
});

test("archive is refused with 409 while a hold is open; consumed and released holds do not block it", async () => {
  const id = await addCustomer();
  await addHold(id, "credit", 10_000, "consumed");
  await addHold(id, "loyalty", 5, "released");
  const open = await addHold(id, "credit", 10_000, "held");
  const refused = await admin.archive(id);
  expect(refused.status).toBe(409);
  expect(refused.body.code).toBe("HOLDS_OPEN");
  expect((await admin.read(id)).body.archivedAt).toBeNull();

  await databases().db.execute(sql`UPDATE account_hold SET status = 'released' WHERE id = ${open}`);
  expect((await admin.archive(id)).status).toBe(200);
});
