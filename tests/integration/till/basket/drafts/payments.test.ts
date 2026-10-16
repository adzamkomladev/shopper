import { eq } from "drizzle-orm";
import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import {
  addDraftTender,
  completeDraftSale,
  holdDraftSale,
  removeDraftTender,
  voidDraftSale,
} from "@shopper/core/till";
import { saleDraftTender, localSale } from "@shopper/db-sqlite";
import { config } from "../../../../support/till/basket";
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

test("pending MoMo cannot complete and confirmed MoMo cannot be removed, held or voided", async () => {
  await withTill(async (db) => {
    await world(db);
    const added = await add(db, 0, { productId: products.ordinary.id, quantityThousandths: 1000 });
    if (!added.draft) throw new Error("Expected draft");
    const draftId = added.draft.id;
    const tenderId = v7();
    await db.transaction((tx) =>
      tx.insert(saleDraftTender).values({
        id: tenderId,
        orgId: scope.orgId,
        draftId,
        position: 0,
        kind: "momo",
        amount: 12_000,
        reference: "payment-one",
        phone: "******6789",
        network: "mtn",
        status: "pending",
        createdAt: at.toISOString(),
      }),
    );
    await expect(
      completeDraftSale(db, config, session, { scope, expectedRevision: 1, at }),
    ).rejects.toMatchObject({ code: "PAYMENT_UNCONFIRMED" });
    await expect(holdDraftSale(db, ctx, { scope, expectedRevision: 1, at })).rejects.toMatchObject({
      code: "DRAFT_BUSY",
    });
    await db.transaction((tx) =>
      tx
        .update(saleDraftTender)
        .set({ status: "confirmed" })
        .where(eq(saleDraftTender.id, tenderId)),
    );
    await expect(
      removeDraftTender(db, ctx, { scope, expectedRevision: 1, at, tenderId }),
    ).rejects.toMatchObject({ code: "DRAFT_BUSY" });
    await expect(holdDraftSale(db, ctx, { scope, expectedRevision: 1, at })).rejects.toMatchObject({
      code: "DRAFT_BUSY",
    });
    await expect(
      voidDraftSale(db, ctx, {
        scope,
        expectedRevision: 1,
        at,
        reason: "Customer left",
        session: { ...session, permissions: [...session.permissions, "sale.void"] },
      }),
    ).rejects.toMatchObject({ code: "DRAFT_BUSY" });
    await completeDraftSale(db, config, session, { scope, expectedRevision: 1, at });
    const [saved] = await db.read((tx) => tx.select().from(localSale));
    expect(saved?.receipt).toMatchObject({
      tenders: [{ kind: "momo", phone: "******6789", reference: "payment-one" }],
    });
  });
});

test("a held basket can be voided by its id without touching the open basket", async () => {
  await withTill(async (db) => {
    await world(db);
    const first = await add(db, 0, { productId: products.ordinary.id, quantityThousandths: 1000 });
    const held = await holdDraftSale(db, ctx, { scope, expectedRevision: 1, at });
    if (!first.draft || !held.draft) throw new Error("Expected held draft");
    const open = await add(db, 0, { productId: products.ordinary.id, quantityThousandths: 1000 });
    const voided = await voidDraftSale(db, ctx, {
      scope,
      expectedRevision: held.draft.revision,
      draftId: held.draft.id,
      at,
      reason: "Duplicate basket",
      session: { ...session, permissions: [...session.permissions, "sale.void"] },
    });
    expect(voided.draft).toMatchObject({ id: first.draft.id, status: "voided" });
    await addDraftTender(db, ctx, {
      scope,
      expectedRevision: open.draft?.revision ?? 0,
      at,
      kind: "cash",
      amount: 12_000,
    });
    await completeDraftSale(db, config, session, { scope, expectedRevision: 2, at });
  });
});
