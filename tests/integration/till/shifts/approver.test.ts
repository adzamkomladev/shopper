// A variance over the threshold is approved with `approve(db, context, { approverId, pin, permission: "shift.approve",
// at }, verify)`; the host then hands the verified approverId to closeShift. An approver whose synced permissions lack
// shift.approve is APPROVAL_FORBIDDEN. (That shift.approve reaches the till is in sync/approvers/refresh.test.ts.)
import { expect, test } from "vite-plus/test";
import { closeNow, declareCash } from "../../../support/till/close";
import { fails, ids, world } from "../../../support/till/drafts";
import {
  auditRows,
  manager,
  pin,
  syncManager,
  tryApprove,
  withTill,
} from "../../../support/till/approvers";
import { theShift } from "../../../support/till/close";

const float = 2_000_000;

test("an approver without shift.approve is APPROVAL_FORBIDDEN", async () => {
  await withTill(async (db) => {
    await syncManager(db, ["refund.approve", "sale.void", "sale.price_override"]);
    await expect(tryApprove(db, pin, "shift.approve")).rejects.toMatchObject(
      fails("APPROVAL_FORBIDDEN"),
    );
  });
});

test("an approver holding shift.approve is verified, and their approval closes a shift over the threshold", async () => {
  await withTill(async (db) => {
    await world(db);
    await syncManager(db, ["shift.approve"]);
    await declareCash(db, float - 60_000);
    await expect(closeNow(db)).rejects.toMatchObject(fails("APPROVAL_REQUIRED"));
    const approverId = await tryApprove(db, pin, "shift.approve");
    expect(approverId).toBe(manager);
    expect(await closeNow(db, { approverId })).toMatchObject({ approverId: manager });
    expect(await theShift(db)).toMatchObject({ status: "closed", approverId: manager });
    expect((await auditRows(db)).find((row) => row.command === "shift.close")).toMatchObject({
      actorId: ids.cashier,
      approverId: manager,
    });
  });
});
