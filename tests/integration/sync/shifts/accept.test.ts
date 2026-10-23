import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { auditLog, shift, shiftMovement, shiftTender } from "@shopper/db-pg";
import { acceptShift, ShiftError } from "@shopper/core/shifts";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { edit, postShift, refigure, shiftEvent } from "../../../support/sales/shifts";
import { denominate } from "../../../support/till/close";
import { api } from "../../../support/till/server";
import { memberWithPin } from "../../../support/sync/members";
import { inventorySession } from "../../../support/till/stock";

let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld();
});
afterAll(async () => {
  await world?.local.close();
});

const id = (event: ReturnType<typeof shiftEvent>) => event.shift.report.shiftId;
const audits = (shiftId: string) =>
  world.db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entityId, shiftId), eq(auditLog.command, "shift.accept")));
const saved = (shiftId: string) => world.db.select().from(shift).where(eq(shift.id, shiftId));
const rejected = async (event: unknown, proof = world.session.proof) =>
  (await postShift(event, proof)).body.rejected;

test("an accepted shift is stored with its tender rows, its movements and one audit row", async () => {
  const event = shiftEvent(world);
  const { body } = await postShift(event, world.session.proof);
  expect(body.accepted).toEqual({ id: id(event), closedAt: event.shift.report.closedAt });
  const [row] = await saved(id(event));
  expect(row).toMatchObject({
    deviceId: world.scope.deviceId,
    storeId: world.config.storeId,
    branchId: world.scope.branchId,
    sessionId: world.session.id,
    closedBy: world.session.userId,
    approverId: null,
    float: 2_000_000,
    varianceThreshold: 50_000,
    expectedCash: 1_036_000,
    declaredCash: 1_036_000,
    anchorSeq: 7,
    anchorHash: "a".repeat(64),
    eventVersion: 2, // stored as read: a v1 Z is upcast
    report: event.shift.report,
  });
  const tenders = await world.db
    .select()
    .from(shiftTender)
    .where(eq(shiftTender.shiftId, id(event)));
  expect(
    tenders
      .map((t) => [t.tender, t.sales, t.refunds, t.expected, t.declared, t.variance])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  ).toEqual([
    ["card", 24_000, 12_000, 12_000, 12_000, 0],
    ["cash", 49_000, 13_000, 1_036_000, 1_036_000, 0],
    ["momo", 0, 0, 0, 0, 0],
  ]);
  const moves = await world.db
    .select()
    .from(shiftMovement)
    .where(eq(shiftMovement.shiftId, id(event)));
  expect(
    moves
      .map((m) => [m.kind, m.amount, m.reason, m.actorId])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  ).toEqual([
    ["drop", 1_000_000, "Safe run", world.session.userId],
    ["no_sale", 0, "Change request", world.session.userId],
  ]);
  const [audit, ...more] = await audits(id(event));
  expect(more).toEqual([]);
  expect(audit).toMatchObject({ entity: "shift", actorId: world.session.userId, approverId: null });
});

test("a replay returns the saved result with no second audit row, and other content under the same id is a conflict", async () => {
  const event = shiftEvent(world);
  const first = await postShift(event, world.session.proof);
  const again = await postShift(event, world.session.proof);
  expect(again.body.accepted).toEqual(first.body.accepted);
  expect(await audits(id(event))).toHaveLength(1);
  expect(await saved(id(event))).toHaveLength(1);
  const changed = edit(event, (z) => (z.anchor.hash = "b".repeat(64)));
  expect(await rejected(changed)).toMatchObject({ code: "CONFLICT" });
  expect(await audits(id(event))).toHaveLength(1);
});

test.each([
  [
    "expected cash that is not float + cash sales - refunds - drops",
    (z: any) => {
      z.cash.expected += 10_000;
      z.tenders[0].expected += 10_000;
      Object.assign(z, refigure(z));
    },
  ],
  [
    "drops that differ from the drop movements",
    (z: any) => {
      z.cash.drops -= 100_000;
      z.cash.expected += 100_000;
      z.tenders[0].expected += 100_000;
      Object.assign(z, refigure(z));
    },
  ],
  [
    "a card expected that is not sales - refunds",
    (z: any) => {
      z.tenders[1].expected += 1_000;
      Object.assign(z, refigure(z));
    },
  ],
  [
    "a cash tender row that differs from the cash box",
    (z: any) => {
      z.tenders[0].expected += 1_000;
      Object.assign(z, refigure(z));
    },
  ],
  ["a variance that is not declared - expected", (z: any) => (z.variances[0].variance += 1)],
  [
    "variances that do not carry the declared totals",
    (z: any) => (z.variances[1].declared += 1_000),
  ],
  [
    "declared cash that its counts do not add up to",
    (z: any) => (z.declared.counts = denominate(1_000_000)),
  ],
  [
    "a negative float that still adds up",
    (z: any) => {
      z.cash.float -= 3_000_000;
      z.cash.expected -= 3_000_000;
      z.tenders[0].expected -= 3_000_000;
      Object.assign(z, refigure(z));
    },
  ],
  [
    "a no-sale without a reason",
    (z: any) => (z.movements.find((m: any) => m.kind === "no_sale").reason = null),
  ],
  [
    "a no-sale that moved money",
    (z: any) => (z.movements.find((m: any) => m.kind === "no_sale").amount = -1),
  ],
])("%s is rejected as SHIFT_MISMATCH and stores nothing", async (_name, tamper) => {
  const event = edit(shiftEvent(world), tamper);
  expect(await rejected(event)).toMatchObject({ code: "SHIFT_MISMATCH" });
  expect(await saved(id(event))).toEqual([]);
  expect(await audits(id(event))).toEqual([]);
});

test("a Z over the threshold needs an approver who holds shift.approve", async () => {
  // GHS 6 short on cash: more than the GHS 5 threshold.
  const short = { cash: 976_000 };
  const unapproved = shiftEvent(world, short);
  expect(await rejected(unapproved)).toMatchObject({ code: "APPROVAL_REQUIRED" });
  expect(await saved(id(unapproved))).toEqual([]);

  const plain = await memberWithPin("Plain Cashier", "cashier", "1111");
  expect(await rejected(shiftEvent(world, { ...short, approverId: plain }))).toMatchObject({
    code: "INVALID_SESSION",
  });

  const manager = await memberWithPin("Shift Manager", "admin", "2468");
  const approved = shiftEvent(world, { ...short, approverId: manager });
  expect((await postShift(approved, world.session.proof)).body.accepted).toBeDefined();
  expect((await saved(id(approved)))[0]).toMatchObject({
    approverId: manager,
    declaredCash: 976_000,
  });
  expect(await audits(id(approved))).toMatchObject([{ approverId: manager }]);
  const [cash] = await world.db
    .select()
    .from(shiftTender)
    .where(and(eq(shiftTender.shiftId, id(approved)), eq(shiftTender.tender, "cash")));
  expect(cash).toMatchObject({ variance: -60_000 });
});

test("a variance of exactly the threshold needs no approver", async () => {
  const event = shiftEvent(world, { cash: 986_000 });
  expect((await postShift(event, world.session.proof)).body.accepted).toBeDefined();
});

test("a closing session without shift.write is rejected", async () => {
  const clerk = await inventorySession();
  const event = shiftEvent(world, {
    closedAt: "2025-12-31T20:00:00.000Z",
    actor: { userId: clerk.userId, sessionId: clerk.sessionId },
  });
  expect(await rejected(event, clerk.proof)).toMatchObject({ code: "INVALID_SESSION" });
  expect(await rejected(shiftEvent(world), "forged-proof")).toMatchObject({
    code: "INVALID_SESSION",
  });
  expect(await saved(id(event))).toEqual([]);
});

test.each([
  ["another device", (z: any) => (z.deviceId = "019a0000-0000-7000-8000-0000000000aa")],
  ["another store", (z: any) => (z.storeId = "019a0000-0000-7000-8000-0000000000ab")],
  ["another branch", (z: any) => (z.branchId = "019a0000-0000-7000-8000-0000000000ac")],
])("a Z for %s is outside the enrolled scope", async (_name, tamper) => {
  expect(await rejected(edit(shiftEvent(world), tamper))).toMatchObject({ code: "SCOPE" });
});

test("a shift for another organisation is outside the enrolled scope", async () => {
  const event = shiftEvent(world);
  event.shift.orgId = "019a0000-0000-7000-8000-0000000000ad";
  expect(await rejected(event)).toMatchObject({ code: "SCOPE" });
});

test("acceptShift throws a ShiftError carrying the code", async () => {
  const principal = {
    orgId: world.scope.orgId,
    deviceId: world.scope.deviceId,
    branchId: world.scope.branchId,
    storeId: world.config.storeId,
  };
  const event = edit(shiftEvent(world), (z) => (z.cash.expected += 1));
  const failure = await acceptShift(world.db, principal, event, world.session.proof).catch(
    (e) => e,
  );
  expect(failure).toBeInstanceOf(ShiftError);
  expect(failure.code).toBe("SHIFT_MISMATCH");
});

test("the route needs a device credential and rejects a malformed event", async () => {
  const event = shiftEvent(world);
  const body = JSON.stringify({ requestId: id(event), proof: world.session.proof, shift: event });
  expect((await api.request("/sync/shifts", { method: "POST", body })).status).toBe(401);
  expect(
    (
      await api.request("/sync/shifts", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${"0".repeat(64)}` },
        body,
      })
    ).status,
  ).toBe(401);
  expect(await saved(id(event))).toEqual([]);
  const malformed = await postShift({ v: 1, type: "shift.closed", shift: {} }, world.session.proof);
  expect(malformed.status).toBe(200);
  expect(malformed.body.rejected).toMatchObject({ code: "INVALID_EVENT" });
});
