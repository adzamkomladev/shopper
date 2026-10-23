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
  folds,
  holdStatuses,
} from "../../support/customers/seed";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let admin: ReturnType<typeof customerApi>;
let cashier: ReturnType<typeof customerApi>;
let accountant: ReturnType<typeof customerApi>;
const db = () => databases().db;

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

/** Winner owes 30 000 with 40 points; loser owes 20 000 - 5 000 = 15 000 with 30 - 5 = 25 points. */
async function pair() {
  const phone = `0245${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;
  const winner = await addCustomer({ name: "Winner", phone });
  const loser = await addCustomer({ name: "Loser", phone });
  await addCreditEntry(winner, "charge", 30_000);
  await addLoyaltyEntry(winner, "earn", 40);
  await addCreditEntry(loser, "charge", 20_000);
  await addCreditEntry(loser, "payment", -5_000);
  await addLoyaltyEntry(loser, "earn", 30);
  await addLoyaltyEntry(loser, "redeem", -5);
  return { winner, loser, phone };
}

test("a merge moves both folds to the winner as transfer pairs and leaves the loser at zero", async () => {
  const { winner, loser, phone } = await pair();
  expect(await folds(winner)).toEqual({ balance: 30_000, points: 40 });
  expect(await folds(loser)).toEqual({ balance: 15_000, points: 25 });

  const merged = await admin.merge(winner, loser);
  expect(merged.status).toBe(200);

  expect(await folds(winner)).toEqual({ balance: 45_000, points: 65 });
  expect(await folds(loser)).toEqual({ balance: 0, points: 0 });
  const credit = await db().execute(
    sql`SELECT customer_id, amount::int AS amount FROM credit_entry WHERE kind = 'transfer' AND customer_id IN (${winner}, ${loser}) ORDER BY amount`,
  );
  expect(credit.rows).toEqual([
    { customer_id: loser, amount: -15_000 },
    { customer_id: winner, amount: 15_000 },
  ]);
  const points = await db().execute(
    sql`SELECT customer_id, points FROM loyalty_entry WHERE reason = 'transfer' AND customer_id IN (${winner}, ${loser}) ORDER BY points`,
  );
  expect(points.rows).toEqual([
    { customer_id: loser, points: -25 },
    { customer_id: winner, points: 25 },
  ]);

  expect((await admin.read(winner)).body).toMatchObject({
    balance: 45_000,
    points: 65,
    archivedAt: null,
  });
  const gone = (await admin.read(loser)).body;
  expect(gone).toMatchObject({ mergedIntoId: winner, balance: 0, points: 0 });
  expect(gone.archivedAt).toEqual(expect.any(String));
  expect((await admin.list(`q=${phone}`)).body.items.map((c: { id: string }) => c.id)).toEqual([
    winner,
  ]);
});

test("a merge is refused while the loser has an open hold; past their hour they are released, the winner's kept", async () => {
  const { winner, loser } = await pair();
  await addHold(loser, "credit", 1_000, "held");
  await addHold(loser, "loyalty", 3, "held");
  await addHold(loser, "credit", 2_000, "consumed");
  await addHold(winner, "credit", 4_000, "held");
  const refused = await admin.merge(winner, loser);
  expect(refused.status).toBe(409);
  expect(refused.body.code).toBe("HOLDS_OPEN");
  await db().execute(
    sql`UPDATE account_hold SET created_at = now() - interval '2 hours' WHERE customer_id = ${loser}`,
  );
  expect((await admin.merge(winner, loser)).status).toBe(200);
  expect((await holdStatuses(loser)).sort()).toEqual(["consumed", "released", "released"]);
  expect(await holdStatuses(winner)).toEqual(["held"]);
});

test("a merge is audited on a valid chain", async () => {
  const { winner, loser } = await pair();
  await admin.merge(winner, loser);
  const log = await db()
    .select()
    .from(auditLog)
    .where(eq(auditLog.orgId, ids.org))
    .orderBy(asc(auditLog.chainSeq));
  const rows = log.filter((row) => row.command === "customer.merge" && row.entityId === winner);
  expect(rows).toHaveLength(1);
  expect(JSON.stringify([rows[0]!.payload, rows[0]!.after])).toContain(loser);
  expect(await verifyChain(log as AuditEntry[])).toMatchObject({ valid: true });
});

test("merging into itself, into an archived winner, or an archived or merged loser is 409 and changes nothing", async () => {
  const { winner, loser } = await pair();
  const before = [await folds(winner), await folds(loser)];
  expect((await admin.merge(winner, winner)).body.code).toBe("MERGE_SELF");
  expect((await admin.merge(winner, winner)).status).toBe(409);

  const archivedWinner = await addCustomer({ archivedAt: new Date() });
  const refusedWinner = await admin.merge(archivedWinner, loser);
  expect(refusedWinner.status).toBe(409);
  expect(refusedWinner.body.code).toBe("MERGE_UNAVAILABLE");

  const archivedLoser = await addCustomer({ archivedAt: new Date() });
  expect((await admin.merge(winner, archivedLoser)).status).toBe(409);

  const other = await addCustomer();
  expect((await admin.merge(winner, loser)).status).toBe(200);
  const twice = await admin.merge(other, loser);
  expect(twice.status).toBe(409);
  expect(twice.body.code).toBe("MERGE_UNAVAILABLE");
  expect((await admin.merge(loser, other)).status).toBe(409);

  expect(await folds(winner)).toEqual({
    balance: before[0]!.balance + before[1]!.balance,
    points: before[0]!.points + before[1]!.points,
  });
  expect((await admin.read(other)).body.archivedAt).toBeNull();
});

test("merge needs customer.manage and stays inside the org", async () => {
  const { winner, loser } = await pair();
  expect((await cashier.merge(winner, loser)).status).toBe(403);
  const foreign = await addCustomer({ orgId: ids.otherOrg });
  expect((await admin.merge(winner, foreign)).status).toBe(404);
  expect((await admin.merge(foreign, loser)).status).toBe(404);
  expect((await admin.merge(winner, v7())).status).toBe(404);
  expect((await admin.read(loser)).body.mergedIntoId).toBeNull();
  expect((await accountant.merge(winner, loser)).status).toBe(200);
});

test("two concurrent merges of one loser into different winners move its money exactly once", async () => {
  const { winner, loser } = await pair();
  const other = await addCustomer({ name: "Other Winner" });
  const [a, b] = await Promise.all([admin.merge(winner, loser), admin.merge(other, loser)]);
  expect([a.status, b.status].sort()).toEqual([200, 409]);
  expect([a, b].find((r) => r.status === 409)!.body.code).toBe("MERGE_UNAVAILABLE");
  expect(await folds(loser)).toEqual({ balance: 0, points: 0 });
  const got = [await folds(winner), await folds(other)];
  expect(got.reduce((sum, f) => sum + f.balance, 0)).toBe(45_000);
  expect(got.reduce((sum, f) => sum + f.points, 0)).toBe(65);
});
