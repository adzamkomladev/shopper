import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit";
import { price } from "@shopper/db-pg";
import { money } from "@shopper/money";
import { acceptSale } from "@shopper/core/sales";
import {
  addToDraft,
  addDraftTender,
  completeDraftSale,
  provisionTillReference,
  readDraft,
  setDraftDiscount,
  setDraftQuantity,
} from "@shopper/core/till";
import { goldenWorld, at } from "../../../support/sales/golden/setup";
import { goldenReferences, products } from "../../../fixtures/sales/golden/references";

const changedAt = new Date("2026-10-15T13:00:00.000Z");
const reprice = defineCommand({
  name: "sale.test.reprice",
  async run(tx, context, input: { newId: string }) {
    await tx.insert(price).values({
      id: input.newId,
      orgId: context.orgId,
      productId: products.labelled.id,
      branchId: context.branchId,
      amount: money(45_000),
      validFrom: changedAt,
    });
    return {};
  },
  audit: () => ({ amount: 45_000 }),
});

test("a scanned price label survives repricing, quantity edits and discounts through server ingest", async () => {
  const world = await goldenWorld();
  const { local, db, config, scope, session, command } = world;
  try {
    const scanned = await addToDraft(local, command, {
      scope,
      at,
      expectedRevision: 0,
      code: "2200002001007",
    });
    expect(scanned.quote.totals.gross).toBe(10_000);
    const original = goldenReferences.prices.find((p) => p.productId === products.labelled.id);
    if (!original || !scanned.draft?.lines[0]) throw new Error("Expected price label fixture");
    const newId = v7();
    await reprice(db, command, { newId });
    await provisionTillReference(local, command, {
      products: [],
      taxRules: [],
      prices: [
        {
          ...original,
          id: newId,
          amount: 45_000,
          validFrom: changedAt.toISOString(),
          validTo: null,
        },
      ],
    });
    expect((await readDraft(local, scope, { at: changedAt })).quote.totals.gross).toBe(10_000);
    await setDraftQuantity(local, command, {
      scope,
      at: changedAt,
      expectedRevision: 1,
      lineId: scanned.draft.lines[0].id,
      quantityThousandths: 666,
    });
    await setDraftDiscount(local, command, {
      scope,
      at: changedAt,
      expectedRevision: 2,
      session,
      lineId: scanned.draft.lines[0].id,
      discount: 1000,
    });
    await addDraftTender(local, command, {
      scope,
      at: changedAt,
      expectedRevision: 3,
      kind: "cash",
      amount: 19_000,
    });
    const event = await completeDraftSale(local, config, session, {
      scope,
      at: changedAt,
      expectedRevision: 4,
    });
    expect(event.sale.lines[0]?.tax).toMatchObject({
      unitPrice: 45_000,
      quantityThousandths: 666,
      discount: 1000,
      gross: 19_000,
    });
    expect(event.sale.lines[0]?.label).toMatchObject({ originalPriceId: original.id });
    const forged = structuredClone(event);
    const forgedLine = forged.sale.lines[0];
    const otherPrice = goldenReferences.prices.find((p) => p.productId === products.standard.id);
    if (!forgedLine?.label || forgedLine.label.kind !== "price" || !otherPrice)
      throw new Error("Expected price label provenance");
    forgedLine.label.originalPriceId = otherPrice.id;
    await expect(
      acceptSale(
        db,
        {
          orgId: scope.orgId,
          deviceId: scope.deviceId,
          branchId: scope.branchId,
          storeId: config.storeId,
        },
        forged,
        session.proof,
        () => changedAt.valueOf(),
      ),
    ).rejects.toMatchObject({ code: "INVALID_REFERENCE" });
    await expect(
      acceptSale(
        db,
        {
          orgId: scope.orgId,
          deviceId: scope.deviceId,
          branchId: scope.branchId,
          storeId: config.storeId,
        },
        event,
        session.proof,
        () => changedAt.valueOf(),
      ),
    ).resolves.toMatchObject({ localId: event.sale.id });
  } finally {
    await local.close();
  }
});
