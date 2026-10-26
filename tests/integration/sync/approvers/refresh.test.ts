// GET /sync/approvers -> { approvers: [{ userId, name, pinHash, permissions }] } (device credential required) and
// refreshApprovers({ database, config }) -> boolean, which replaces the till's approver list from it.
import { expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { member } from "@shopper/db-pg";
import { refreshApprovers } from "@shopper/sync";
import { verifyPin } from "@shopper/auth/devices";
import { approve } from "@shopper/core/till";
import { tillApprover, type TillDatabase } from "@shopper/db-sqlite";
import { foreignManagerWithPin, memberWithPin } from "../../../support/sync/members";
import { auditRows, fails, withTill } from "../../../support/till/drafts";
import { ids } from "../../../support/till/sales";
import { syncHeaders } from "../../../support/till/requests";
import {
  api,
  appVersion,
  context,
  databases,
  deviceId,
  deviceToken,
  devices,
  principal,
  syncProtocol,
} from "../../../support/till/server";

const config = () => ({
  orgId: context.orgId,
  deviceId,
  appVersion,
  protocol: syncProtocol,
  upstream: api.url,
  deviceToken,
});
const refresh = (database: TillDatabase) => refreshApprovers({ database, config: config() });
const stored = (database: TillDatabase) => database.read((tx) => tx.select().from(tillApprover));
const audit = () => ({ ...context, deviceId, actorId: principal.userId });

test("a manager's PIN hash and approval grants reach the till; a cashier's do not", async () => {
  const managerId = await memberWithPin("Esi Manager", "admin", "2468");
  const cashierId = await memberWithPin("Kojo Cashier", "cashier", "1111");
  const response = await api.request("/sync/approvers", { headers: syncHeaders() });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { approvers: { userId: string }[] };
  expect(body.approvers.map((row) => row.userId)).toContain(managerId);
  expect(body.approvers.map((row) => row.userId)).not.toContain(cashierId);
  await withTill(async (database) => {
    expect(await refresh(database)).toBe(true);
    const rows = await stored(database);
    expect(rows.map((row) => row.userId)).toContain(managerId);
    expect(rows.map((row) => row.userId)).not.toContain(cashierId);
    const manager = rows.find((row) => row.userId === managerId)!;
    expect([...manager.permissions].sort()).toEqual([
      "refund.approve",
      "sale.price_override",
      "sale.void",
      "shift.approve",
    ]);
    expect(await verifyPin(manager.pinHash, "2468")).toBe(true);
  });
});

test("shift.approve reaches the till for a manager who holds it and approves a shift close there", async () => {
  const managerId = await memberWithPin("Kwame Manager", "admin", "8642");
  await withTill(async (database) => {
    await refresh(database);
    const row = (await stored(database)).find((entry) => entry.userId === managerId);
    expect(row?.permissions).toContain("shift.approve");
    const approved = await approve(
      database,
      audit(),
      { approverId: managerId, pin: "8642", permission: "shift.approve", at: new Date() },
      verifyPin,
    );
    expect(approved).toBe(managerId);
  });
});

test("a deactivated manager drops off the till's approvers at its next refresh", async () => {
  const managerId = await memberWithPin("Efua Manager", "admin", "2468");
  const { db } = databases();
  await withTill(async (database) => {
    await refresh(database);
    expect((await stored(database)).map((row) => row.userId)).toContain(managerId);
    await db
      .update(member)
      .set({ deactivatedAt: new Date() })
      .where(eq(member.userId, managerId));
    await refresh(database);
    expect((await stored(database)).map((row) => row.userId)).not.toContain(managerId);
  });
});

test("a manager in another org never reaches this org's till", async () => {
  const foreignId = await foreignManagerWithPin(ids.otherOrg, "1357");
  const response = await api.request("/sync/approvers", { headers: syncHeaders() });
  const body = (await response.json()) as { approvers: { userId: string }[] };
  expect(body.approvers.map((row) => row.userId)).not.toContain(foreignId);
});

test("a re-assigned PIN replaces the till's copy and clears its failures", async () => {
  const managerId = await memberWithPin("Ama Manager", "admin", "2468");
  await withTill(async (database) => {
    await refresh(database);
    const wrong = approve(
      database,
      audit(),
      { approverId: managerId, pin: "0000", permission: "sale.void", at: new Date() },
      verifyPin,
    );
    await expect(wrong).rejects.toMatchObject(fails("APPROVAL_INVALID"));
    expect((await stored(database)).find((row) => row.userId === managerId)?.attempts).toBe(1);
    await refresh(database);
    expect((await stored(database)).find((row) => row.userId === managerId)?.attempts).toBe(1);
    await devices.assignPin(principal, { userId: managerId, pin: "9753" });
    await refresh(database);
    const row = (await stored(database)).find((entry) => entry.userId === managerId)!;
    expect(row.attempts).toBe(0);
    expect(await verifyPin(row.pinHash, "9753")).toBe(true);
    expect(await verifyPin(row.pinHash, "2468")).toBe(false);
  });
});

test("the refresh audit holds the count and user ids, never a hash", async () => {
  await withTill(async (database) => {
    await refresh(database);
    const [entry] = (await auditRows(database)).filter(
      (row) => row.command === "till.approvers.refresh",
    );
    expect(Object.keys(entry!.payload as object).sort()).toEqual(["count", "userIds"]);
    expect(JSON.stringify(entry)).not.toContain("scrypt");
  });
});

test("an unreachable or unauthorised server leaves the list alone", async () => {
  await withTill(async (database) => {
    await refresh(database);
    const before = await stored(database);
    const refused = await refreshApprovers({
      database,
      config: { ...config(), deviceToken: "wrong" },
    });
    expect(refused).toBe(false);
    expect(await stored(database)).toEqual(before);
  });
});
