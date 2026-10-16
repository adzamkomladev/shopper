import { config } from "../../../support/till/basket";
import { expect, test } from "vite-plus/test";
import {
  applyDraftPayment,
  addDraftTender,
  completeDraftSale,
  storePaymentUpdate,
  voidDraftSale,
  listPurchases,
  readPurchase,
  setDraftQuantity,
} from "@shopper/core/till";
import {
  add,
  at,
  ctx,
  products,
  scope,
  session,
  withTill,
  world,
} from "../../../support/till/drafts";

test("MoMo confirmation updates the same audited draft tender without storing the raw phone", async () => {
  await withTill(async (db) => {
    await world(db);
    await add(db, 0, { productId: products.ordinary.id });
    const input = {
      scope,
      at,
      reference: "019a0000-0000-7000-8000-000000000099",
      amount: 12_000,
      phone: "******4987",
      network: "mtn",
      status: "pending",
    };
    const pending = await applyDraftPayment(db, ctx, { ...input, expectedRevision: 1 });
    expect(pending.draft?.tenders).toHaveLength(1);
    expect("settlement" in pending && pending.settlement?.balance).toBe(12_000);
    const confirmed = await applyDraftPayment(db, ctx, {
      ...input,
      expectedRevision: 2,
      status: "confirmed",
    });
    expect(confirmed.draft?.tenders).toHaveLength(1);
    expect(confirmed.draft?.tenders[0]).toMatchObject({ status: "confirmed", phone: "******4987" });
    expect("settlement" in confirmed && confirmed.settlement?.balance).toBe(0);
    await expect(
      addDraftTender(db, ctx, {
        scope,
        at,
        expectedRevision: 3,
        kind: "card",
        amount: 100,
        approvalCode: "TEST12",
      }),
    ).rejects.toMatchObject({ code: "TENDER_OVERPAID" });
  });
});

test("a late confirmation after void remains visible as an unresolved payment", async () => {
  await withTill(async (db) => {
    await world(db);
    await add(db, 0, { productId: products.ordinary.id });
    const input = {
      scope,
      at,
      reference: "019a0000-0000-7000-8000-000000000098",
      amount: 12_000,
      phone: "******4987",
      network: "mtn",
      status: "pending",
      failureReason: null,
    };
    await applyDraftPayment(db, ctx, { ...input, expectedRevision: 1 });
    await voidDraftSale(db, ctx, {
      scope,
      at,
      expectedRevision: 2,
      reason: "Customer left",
      session: { ...session, permissions: [...session.permissions, "sale.void"] },
    });
    await storePaymentUpdate(db, ctx, { ...input, status: "confirmed", failureReason: null });
    const listed = await listPurchases(db, { scope, at, status: "pending" });
    expect(listed.purchases).toMatchObject([
      { id: input.reference, status: "pending", kinds: ["momo"], total: 12_000 },
    ]);
  });
});

test("a confirmed MoMo payment cannot complete a second local sale", async () => {
  await withTill(async (db) => {
    await world(db);
    await add(db, 0, { productId: products.ordinary.id });
    const input = {
      scope,
      at,
      reference: "019a0000-0000-7000-8000-000000000097",
      amount: 12_000,
      phone: "******4987",
      network: "mtn",
      status: "confirmed",
    };
    await applyDraftPayment(db, ctx, { ...input, expectedRevision: 1 });
    await completeDraftSale(db, config, session, { scope, at, expectedRevision: 2 });
    await add(db, 0, { productId: products.ordinary.id });
    await expect(
      applyDraftPayment(db, ctx, { ...input, expectedRevision: 1 }),
    ).rejects.toMatchObject({ code: "PAYMENT_INVALID" });
  });
});

test("basket edits cannot shrink below a reserved MoMo charge", async () => {
  await withTill(async (db) => {
    await world(db);
    const added = await add(db, 0, { productId: products.ordinary.id });
    const lineId = added.draft!.lines[0]!.id;
    await applyDraftPayment(db, ctx, {
      scope,
      at,
      expectedRevision: 1,
      reference: "019a0000-0000-7000-8000-000000000096",
      amount: 12_000,
      phone: "******4987",
      network: "mtn",
      status: "pending",
    });
    await expect(
      setDraftQuantity(db, ctx, {
        scope,
        at,
        expectedRevision: 2,
        lineId,
        quantityThousandths: 500,
      }),
    ).rejects.toMatchObject({ code: "TENDER_OVERPAID" });
  });
});

test("a consumed MoMo reference cannot reopen as an unresolved purchase detail", async () => {
  await withTill(async (db) => {
    await world(db);
    await add(db, 0, { productId: products.ordinary.id });
    const reference = "019a0000-0000-7000-8000-000000000095";
    await applyDraftPayment(db, ctx, {
      scope,
      at,
      expectedRevision: 1,
      reference,
      amount: 12_000,
      phone: "******4987",
      network: "mtn",
      status: "confirmed",
    });
    const event = await completeDraftSale(db, config, session, { scope, at, expectedRevision: 2 });
    expect((await listPurchases(db, { scope, at, status: "pending" })).purchases).toEqual([]);
    await expect(readPurchase(db, { scope, at, saleId: reference })).rejects.toMatchObject({
      code: "SALE_UNKNOWN",
    });
    expect(await readPurchase(db, { scope, at, saleId: event.sale.id })).toMatchObject({
      id: event.sale.id,
      status: "completed",
    });
  });
});

test.each(["failed", "expired"] as const)(
  "a %s MoMo attempt does not block replacement tenders",
  async (status) => {
    for (const replacement of ["cash", "card", "momo"] as const) {
      await withTill(async (db) => {
        await world(db);
        await add(db, 0, { productId: products.ordinary.id });
        const reference = "019a0000-0000-7000-8000-000000000094";
        const input = { scope, at, reference, amount: 12_000, phone: "******4987", network: "mtn" };
        await applyDraftPayment(db, ctx, { ...input, status, expectedRevision: 1 });
        if (replacement === "momo") {
          await applyDraftPayment(db, ctx, {
            ...input,
            reference: "019a0000-0000-7000-8000-000000000093",
            status: "confirmed",
            expectedRevision: 2,
          });
        } else {
          await addDraftTender(db, ctx, {
            scope,
            at,
            expectedRevision: 2,
            kind: replacement,
            amount: 12_000,
            ...(replacement === "card" ? { approvalCode: "TEST12" } : {}),
          });
        }
        const event = await completeDraftSale(db, config, session, {
          scope,
          at,
          expectedRevision: 3,
        });
        expect(event.sale).toMatchObject({ paid: 12_000, total: 12_000, change: 0 });
        expect(event.sale.tenders).toHaveLength(1);
        expect(event.sale.tenders[0]).toMatchObject({ kind: replacement, amount: 12_000 });
        await storePaymentUpdate(db, ctx, { ...input, status: "confirmed", failureReason: null });
        expect((await listPurchases(db, { scope, at, status: "pending" })).purchases).toMatchObject(
          [{ id: reference, total: 12_000, status: "pending" }],
        );
      });
    }
  },
);
