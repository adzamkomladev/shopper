// recordRefund(db, config, session, input) enforces the return window, requirePinForReturns, final-sale lines and
// the quantities left, and audits the actor and the approver on one `refund.record` row.
import { expect, test } from "vite-plus/test";
import { add, money } from "@shopper/money";
import {
  auditRows,
  expectChain,
  manager,
  syncManager,
  tryApprove,
} from "../../../support/till/approvers";
import { world, withTill } from "../../../support/till/drafts";
import {
  fails,
  markFinalSale,
  refund,
  refundRows,
  saveSettings,
  sell,
} from "../../../support/till/refunds";
import { products } from "../../../support/till/drafts";
import { ids } from "../../../support/till/sales";

const recorded = async (db: Parameters<typeof refundRows>[0]) =>
  (await auditRows(db)).filter((row) => row.command === "refund.record");

test("a sale inside the window is refunded on the cashier's own permission, audited with the actor", async () => {
  await withTill(async (db) => {
    await world(db);
    const sale = await sell(db, "2025-12-20T10:00:00.000Z");
    const { event, receipt } = await refund(db, sale, [[0, 1_000]]);
    expect(event.refund).toMatchObject({
      originalSaleId: sale.id,
      approverId: null,
      total: 12_000,
    });
    expect(receipt).toMatchObject({ kind: "refund", refundOf: sale.receiptNumber });
    const [row] = await recorded(db);
    expect(row).toMatchObject({
      actorId: ids.cashier,
      approverId: null,
      entityId: event.refund.id,
    });
    await expectChain(db);
  });
});

test("a sale older than the window needs an approver with refund.approve, and the audit shows both people", async () => {
  await withTill(async (db) => {
    await world(db);
    const old = await sell(db, "2025-11-01T10:00:00.000Z");
    await expect(refund(db, old, [[0, 1_000]])).rejects.toMatchObject(fails("APPROVAL_REQUIRED"));
    expect(await refundRows(db)).toEqual([]);

    await syncManager(db);
    const approverId = await tryApprove(db);
    const { event } = await refund(db, old, [[0, 1_000]], { approverId });
    expect(event.refund.approverId).toBe(manager);
    const [row] = await recorded(db);
    expect(row).toMatchObject({ actorId: ids.cashier, approverId: manager });
    await expectChain(db);
  });
});

test("the window ends exactly returnWindowDays after the sale", async () => {
  await withTill(async (db) => {
    await world(db);
    const inside = await sell(db, "2025-12-01T23:30:00.000Z");
    const outside = await sell(db, "2025-12-01T23:29:00.000Z");
    await refund(db, inside, [[0, 1_000]]);
    await expect(refund(db, outside, [[0, 1_000]])).rejects.toMatchObject(
      fails("APPROVAL_REQUIRED"),
    );
  });
});

test("the register's return window setting moves the limit", async () => {
  await withTill(async (db) => {
    await world(db);
    const sale = await sell(db, "2025-12-20T10:00:00.000Z");
    await saveSettings(db, { returnWindowDays: 5 });
    await expect(refund(db, sale, [[0, 1_000]])).rejects.toMatchObject(fails("APPROVAL_REQUIRED"));
    await saveSettings(db, { returnWindowDays: 30 });
    await refund(db, sale, [[0, 1_000]]);
    const settings = (await auditRows(db)).filter((row) => row.command === "till.settings.save");
    expect(settings[0]?.payload).toMatchObject({ returnWindowDays: { before: 30, after: 5 } });
  });
});

test("requirePinForReturns asks for an approver on every refund", async () => {
  await withTill(async (db) => {
    await world(db);
    const sale = await sell(db, "2025-12-30T10:00:00.000Z");
    await saveSettings(db, { requirePinForReturns: true });
    await expect(refund(db, sale, [[0, 1_000]])).rejects.toMatchObject(fails("APPROVAL_REQUIRED"));
    await syncManager(db);
    const { event } = await refund(db, sale, [[0, 1_000]], { approverId: await tryApprove(db) });
    expect(event.refund.approverId).toBe(manager);
  });
});

test("a final-sale line cannot be refunded, with or without an approver", async () => {
  await withTill(async (db) => {
    await world(db);
    await markFinalSale(db, products.ordinary.id);
    const sale = await sell(db, "2025-12-30T10:00:00.000Z");
    await expect(refund(db, sale, [[0, 1_000]])).rejects.toMatchObject(fails("FINAL_SALE"));
    await syncManager(db);
    await expect(
      refund(db, sale, [[0, 1_000]], { approverId: await tryApprove(db) }),
    ).rejects.toMatchObject(fails("FINAL_SALE"));
    expect(await refundRows(db)).toEqual([]);
  });
});

test("quantities are checked against what is left, and partial refunds add up to the sold line", async () => {
  await withTill(async (db) => {
    await world(db);
    const sale = await sell(db, "2025-12-30T10:00:00.000Z");
    const first = await refund(db, sale, [[0, 2_000]]);
    await expect(refund(db, sale, [[0, 2_000]])).rejects.toMatchObject(
      fails("REFUND_EXCEEDS_SALE"),
    );
    const second = await refund(db, sale, [[0, 1_000]]);
    expect(
      [first, second].reduce((total, { event }) => add(total, event.refund.totals.gross), money(0)),
    ).toBe(sale.lines[0]!.tax.gross);
    await expect(refund(db, sale, [[0, 1_000]])).rejects.toMatchObject(
      fails("REFUND_EXCEEDS_SALE"),
    );
    expect(await refundRows(db)).toHaveLength(2);
  });
});

test("an unknown sale, an unknown line and a non-positive quantity are refused", async () => {
  await withTill(async (db) => {
    await world(db);
    const sale = await sell(db, "2025-12-30T10:00:00.000Z");
    await expect(refund(db, { ...sale, id: ids.device }, [[0, 1_000]])).rejects.toMatchObject(
      fails("SALE_UNKNOWN"),
    );
    await expect(
      refund(db, sale, [[0, 1_000]], {
        lines: [{ lineId: ids.device, quantityThousandths: 1_000 }],
      }),
    ).rejects.toMatchObject(fails("LINE_UNKNOWN"));
    await expect(refund(db, sale, [[0, 0]])).rejects.toMatchObject(fails("QUANTITY_INVALID"));
    await expect(refund(db, sale, [[0, 500.5]])).rejects.toMatchObject(fails("QUANTITY_INVALID"));
  });
});

test("a session without refund.request cannot refund", async () => {
  await withTill(async (db) => {
    await world(db);
    const sale = await sell(db, "2025-12-30T10:00:00.000Z");
    await expect(
      refund(db, sale, [[0, 1_000]], { permissions: ["sale.create"] }),
    ).rejects.toMatchObject(fails("permission"));
  });
});
