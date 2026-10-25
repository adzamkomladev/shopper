// approve(db, context, { approverId, pin, permission, at }, verify) checks the PIN against till_approver.
// Errors (TillError codes): APPROVAL_FORBIDDEN, APPROVAL_OFFLINE, APPROVAL_LOCKED, APPROVAL_INVALID.
import { expect, test } from "vite-plus/test";
import { approve, authorize } from "@shopper/core/till";
import { tillApprover } from "@shopper/db-sqlite";
import {
  at,
  auditRows,
  context,
  auditText,
  expectChain,
  manager,
  pin,
  syncManager,
  tryApprove,
  withTill,
} from "../../../support/till/approvers";
import { fails, ids, session } from "../../../support/till/drafts";

const days = (n: number) => new Date(at.valueOf() + n * 86_400_000);
const row = (db: Parameters<Parameters<typeof withTill>[0]>[0]) =>
  db.read(async (tx) => (await tx.select().from(tillApprover))[0]);

test("the right PIN returns the approver and the audit chain verifies", async () => {
  await withTill(async (db) => {
    await syncManager(db);
    expect(await tryApprove(db)).toBe(manager);
    const rows = await expectChain(db);
    expect(rows.map((entry) => entry.command)).toEqual(["till.approvers.refresh"]);
  });
});

test("five wrong PINs lock the approver for 15 minutes, even against the right PIN", async () => {
  await withTill(async (db) => {
    await syncManager(db);
    for (let attempt = 1; attempt <= 5; attempt++)
      await expect(tryApprove(db, "0000")).rejects.toMatchObject(fails("APPROVAL_INVALID"));
    expect((await row(db))?.lockedUntil).toBe(at.valueOf() + 15 * 60_000);
    await expect(tryApprove(db)).rejects.toMatchObject(fails("APPROVAL_LOCKED"));
    expect(
      await tryApprove(db, pin, "refund.approve", new Date(at.valueOf() + 15 * 60_000 + 1)),
    ).toBe(manager);
    expect(await row(db)).toMatchObject({ attempts: 0, lockedUntil: null });
    const commands = (await expectChain(db)).map((entry) => entry.command);
    expect(commands.filter((name) => name === "approval.failed")).toHaveLength(5);
    expect(commands.at(-1)).toBe("approval.reset");
  });
});

test("parallel wrong PINs still lock after five; the sixth is refused without a guess", async () => {
  await withTill(async (db) => {
    await syncManager(db);
    const tries = await Promise.allSettled(Array.from({ length: 6 }, () => tryApprove(db, "0000")));
    const codes = tries.map((t) =>
      t.status === "rejected" ? (t.reason as { code: string }).code : "ok",
    );
    expect(codes.filter((code) => code === "APPROVAL_INVALID")).toHaveLength(5);
    expect(codes.at(-1)).toBe("APPROVAL_LOCKED");
    expect((await row(db))?.lockedUntil).toBe(at.valueOf() + 15 * 60_000);
  });
});

test("a correct PIN clears earlier failures and audits the reset", async () => {
  await withTill(async (db) => {
    await syncManager(db);
    await expect(tryApprove(db, "0000")).rejects.toMatchObject(fails("APPROVAL_INVALID"));
    await tryApprove(db);
    expect((await row(db))?.attempts).toBe(0);
    const rows = await auditRows(db);
    expect(rows.map((entry) => entry.command)).toContain("approval.reset");
    expect(auditText(rows)).not.toContain(pin);
  });
});

test("an approver without the needed permission, or an unknown one, is refused", async () => {
  await withTill(async (db) => {
    await syncManager(db, ["refund.approve"]);
    await expect(tryApprove(db, pin, "sale.void")).rejects.toMatchObject(
      fails("APPROVAL_FORBIDDEN"),
    );
    const stranger = "019a0000-0000-7000-8000-0000000000a2";
    await expect(
      approve(
        db,
        context,
        { approverId: stranger, pin, permission: "refund.approve", at },
        async () => true,
      ),
    ).rejects.toMatchObject(fails("APPROVAL_FORBIDDEN"));
  });
});

test("approvals stop working when the list is older than 7 days", async () => {
  await withTill(async (db) => {
    await syncManager(db);
    expect(await tryApprove(db, pin, "refund.approve", days(7))).toBe(manager);
    await expect(
      tryApprove(db, pin, "refund.approve", new Date(days(7).valueOf() + 1)),
    ).rejects.toMatchObject(fails("APPROVAL_OFFLINE"));
  });
});

const scope = { orgId: ids.org, deviceId: ids.device, branchId: ids.branch };

test("authorize accepts a verified approver, demands one when mandatory, and otherwise checks the session", () => {
  const holder = { ...session, permissions: ["sale.void"] };
  expect(authorize(session, scope, "sale.void", at, manager, true)).toBe(manager);
  expect(() => authorize(holder, scope, "sale.void", at, undefined, true)).toThrow(
    expect.objectContaining(fails("APPROVAL_REQUIRED")),
  );
  expect(authorize(holder, scope, "sale.void", at, undefined, false)).toBeUndefined();
  expect(() => authorize(session, scope, "sale.void", at, undefined, false)).toThrow(
    expect.objectContaining(fails("permission")),
  );
});
