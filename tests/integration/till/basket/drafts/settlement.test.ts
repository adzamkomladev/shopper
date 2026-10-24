import { expect, test } from "vite-plus/test";
import {
  addDraftTender,
  completeDraftSale,
  holdDraftSale,
  listHeldDraftSales,
  resumeDraftSale,
  setDraftDiscount,
  voidDraftSale,
} from "@shopper/core/till";
import { localSale, outbox, saleDraft, saleDraftLine, saleDraftTender } from "@shopper/db-sqlite";
import { provisionTillReference } from "@shopper/core/till";
import { config, refPrice } from "../../../../support/till/basket";
import {
  add,
  at,
  ctx,
  products,
  scope,
  session,
  withTill,
  world,
} from "../../../../support/till/drafts";

test("split cash and card complete with a reconciled v4 event", async () => {
  await withTill(async (db) => {
    await world(db);
    const draft = await addOne(db);
    await addDraftTender(db, ctx, {
      scope,
      expectedRevision: draft.revision,
      at,
      kind: "card",
      amount: 5_000,
      approvalCode: "AB1234",
      last4: "4242",
    });
    await addDraftTender(db, ctx, {
      scope,
      expectedRevision: 2,
      at,
      kind: "cash",
      amount: 7_000,
    });

    const event = await completeDraftSale(db, config, session, {
      scope,
      expectedRevision: 3,
      at,
    });
    expect(event).toMatchObject({ v: 6, type: "sale.recorded" });
    expect(event.sale.tenders).toMatchObject([
      { kind: "card", amount: 5_000, approvalCode: "AB1234", last4: "4242" },
      { kind: "cash", amount: 7_000 },
    ]);
    expect(event.sale).toMatchObject({ paid: 12_000, change: 0, total: 12_000 });
    const stored = await db.read((tx) => tx.select().from(localSale));
    expect(stored[0]?.payload).toMatchObject(event.sale);
  });
});

test("a card tender cannot exceed the draft total", async () => {
  await withTill(async (db) => {
    await world(db);
    const draft = await addOne(db);
    await expect(
      addDraftTender(db, ctx, {
        scope,
        expectedRevision: draft.revision,
        at,
        kind: "card",
        amount: 12_001,
        approvalCode: "AB1234",
      }),
    ).rejects.toMatchObject({ code: "TENDER_OVERPAID" });
    expect(await db.read((tx) => tx.select().from(saleDraftTender))).toEqual([]);
    expect(await db.read((tx) => tx.select().from(outbox))).toEqual([]);
  });
});

test("cash completion records the 10p rounding adjustment on the sale", async () => {
  await withTill(async (db) => {
    await world(db);
    await provisionTillReference(db, ctx, {
      products: [],
      prices: [refPrice(products.ordinary.id, 12_500, { branchId: scope.branchId })],
      taxRules: [],
      cashRounding: "10p",
    });
    const draft = await addOne(db);
    await addDraftTender(db, ctx, {
      scope,
      expectedRevision: draft.revision,
      at,
      kind: "cash",
      amount: 13_000,
    });
    const event = await completeDraftSale(db, config, session, {
      scope,
      expectedRevision: 2,
      at,
    });
    expect(event.sale).toMatchObject({
      totals: { gross: 12_500 },
      cashRounding: 500,
      total: 13_000,
    });
    expect(event.sale.paid - event.sale.change).toBe(event.sale.total);
  });
});

test("held sales can be listed and resumed without changing their lines", async () => {
  await withTill(async (db) => {
    await world(db);
    const draft = await addOne(db);
    const held = await holdDraftSale(db, ctx, {
      scope,
      expectedRevision: draft.revision,
      at,
      name: "Ama's basket",
    });
    expect(held.draft).toMatchObject({ status: "held", name: "Ama's basket" });
    const listed = await listHeldDraftSales(db, scope, { at });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.draft).toMatchObject({ id: draft.id, lines: draft.lines });

    const resumed = await resumeDraftSale(db, ctx, {
      scope,
      expectedRevision: held.draft?.revision ?? 0,
      at,
      draftId: draft.id,
    });
    expect(resumed.draft).toMatchObject({ id: draft.id, status: "open", lines: draft.lines });
  });
});

test("a held draft cannot resume while another open draft contains lines", async () => {
  await withTill(async (db) => {
    await world(db);
    const held = await addOne(db);
    const heldView = await holdDraftSale(db, ctx, {
      scope,
      expectedRevision: held.revision,
      at,
    });
    await addOne(db);
    await expect(
      resumeDraftSale(db, ctx, {
        scope,
        expectedRevision: heldView.draft?.revision ?? 0,
        at,
        draftId: held.id,
      }),
    ).rejects.toMatchObject({ code: "DRAFT_BUSY" });
    expect(await listHeldDraftSales(db, scope, { at })).toHaveLength(1);
  });
});

test("void needs permission and a reason, and preserves the voided draft", async () => {
  await withTill(async (db) => {
    await world(db);
    const draft = await addOne(db);
    const before = await db.read((tx) => tx.select().from(saleDraftLine));
    const authorized = {
      ...session,
      roleName: "Admin",
      permissions: [...session.permissions, "sale.void"],
    };
    await expect(
      voidDraftSale(db, ctx, {
        scope,
        expectedRevision: draft.revision,
        at,
        session: authorized,
        reason: "",
      }),
    ).rejects.toThrow();
    const voided = await voidDraftSale(db, ctx, {
      scope,
      expectedRevision: draft.revision,
      at,
      session: authorized,
      reason: "Customer changed mind",
    });
    expect(voided.draft).toMatchObject({ status: "voided" });
    expect(await db.read((tx) => tx.select().from(saleDraft))).toMatchObject([
      { id: draft.id, status: "voided", voidReason: "Customer changed mind" },
    ]);
    expect(await db.read((tx) => tx.select().from(saleDraftLine))).toEqual(before);
    expect(await db.read((tx) => tx.select().from(localSale))).toEqual([]);
    expect(await db.read((tx) => tx.select().from(outbox))).toEqual([]);
  });
});

test("discount requires permission and reduces the quoted gross", async () => {
  await withTill(async (db) => {
    await world(db);
    const draft = await addOne(db);
    const lineId = draft.lines[0]?.id;
    if (!lineId) throw new Error("Expected draft line");
    await expect(
      setDraftDiscount(db, ctx, {
        scope,
        expectedRevision: draft.revision,
        at,
        session,
        lineId,
        discount: 1_000,
      }),
    ).rejects.toThrow();
    await expect(
      setDraftDiscount(db, ctx, {
        scope,
        expectedRevision: draft.revision,
        at,
        session: {
          ...session,
          roleName: "Admin",
          permissions: [...session.permissions, "sale.discount"],
        },
        lineId,
        discount: 12_001,
      }),
    ).rejects.toMatchObject({ code: "DISCOUNT_INVALID" });
    const discounted = await setDraftDiscount(db, ctx, {
      scope,
      expectedRevision: draft.revision,
      at,
      session: {
        ...session,
        roleName: "Admin",
        permissions: [...session.permissions, "sale.discount"],
      },
      lineId,
      discount: 1_000,
    });
    expect(discounted.quote.lines[0]?.tax).toMatchObject({ discount: 1_000, gross: 11_000 });
    expect(discounted.draft?.revision).toBe(2);
  });
});

async function addOne(db: Parameters<typeof add>[0]) {
  const view = await add(db, 0, { productId: products.ordinary.id, quantityThousandths: 1_000 });
  if (!view.draft) throw new Error("Expected draft");
  return view.draft;
}
