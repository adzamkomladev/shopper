// Voiding after a cash or card tender needs a manager (approverId, verified by the host) even when the cashier holds
// sale.void. Without tenders a cashier lacking sale.void can void with an approver. A confirmed MoMo draft never voids.
import { expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { addDraftTender, voidDraftSale } from "@shopper/core/till";
import { saleDraftTender } from "@shopper/db-sqlite";
import { manager } from "../../../../support/till/approvers";
import {
  add,
  at,
  auditRows,
  ctx,
  expectChain,
  fails,
  products,
  scope,
  session,
  withTill,
  world,
} from "../../../../support/till/drafts";

const voider = { ...session, permissions: [...session.permissions, "sale.void"] };
const reason = "Customer left";
const voidIt = (
  db: Parameters<Parameters<typeof withTill>[0]>[0],
  over: { session?: typeof session; approverId?: string } = {},
) =>
  voidDraftSale(db, ctx, {
    scope,
    at,
    expectedRevision: 2,
    reason,
    session: over.session ?? voider,
    ...(over.approverId ? { approverId: over.approverId } : {}),
  });
const basket = async (db: Parameters<Parameters<typeof withTill>[0]>[0], tendered: boolean) => {
  await world(db);
  const added = await add(db, 0, { productId: products.ordinary.id, quantityThousandths: 1000 });
  if (tendered)
    await addDraftTender(db, ctx, { scope, at, expectedRevision: 1, kind: "cash", amount: 5_000 });
  // Both cases end at revision 2.
  else await add(db, 1, { productId: products.ordinary.id, quantityThousandths: 1000 });
  return added.draft!.id;
};

test("a tendered draft needs a manager approver even for a cashier who holds sale.void", async () => {
  await withTill(async (db) => {
    await basket(db, true);
    await expect(voidIt(db)).rejects.toMatchObject(fails("APPROVAL_REQUIRED"));
    const view = await voidIt(db, { approverId: manager });
    expect(view.draft).toMatchObject({ status: "voided", voidReason: reason });
    const [entry] = (await auditRows(db)).filter((row) => row.command === "till.draft.void");
    expect(entry).toMatchObject({ actorId: scope.cashierId, approverId: manager });
    await expectChain(db);
  });
});

test("a cashier without sale.void voids an untendered draft with an approver; both are audited", async () => {
  await withTill(async (db) => {
    await basket(db, false);
    await expect(voidIt(db, { session })).rejects.toMatchObject(fails("APPROVAL_REQUIRED"));
    await voidIt(db, { session, approverId: manager });
    const [entry] = (await auditRows(db)).filter((row) => row.command === "till.draft.void");
    expect(entry).toMatchObject({ actorId: scope.cashierId, approverId: manager });
    await expectChain(db);
  });
});

test("an untendered draft voids with no approver for a cashier who holds sale.void", async () => {
  await withTill(async (db) => {
    await basket(db, false);
    await voidIt(db);
    const [entry] = (await auditRows(db)).filter((row) => row.command === "till.draft.void");
    expect(entry?.approverId).toBeNull();
  });
});

test("a draft with a confirmed MoMo tender still cannot be voided, approver or not", async () => {
  await withTill(async (db) => {
    const draftId = await basket(db, false);
    await db.transaction((tx) =>
      tx.insert(saleDraftTender).values({
        id: v7(),
        orgId: scope.orgId,
        draftId,
        position: 0,
        kind: "momo",
        amount: 12_000,
        reference: "payment-one",
        status: "confirmed",
        createdAt: at.toISOString(),
      }),
    );
    await expect(voidIt(db, { approverId: manager })).rejects.toMatchObject(fails("DRAFT_BUSY"));
    expect(
      await db.read((tx) =>
        tx.select().from(saleDraftTender).where(eq(saleDraftTender.draftId, draftId)),
      ),
    ).toHaveLength(1);
  });
});
