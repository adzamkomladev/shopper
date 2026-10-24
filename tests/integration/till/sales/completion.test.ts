import { expect, test } from "vite-plus/test";
import { verifyChain, type AuditEntry } from "@shopper/audit";
import {
  localSale,
  outbox,
  saleDraft,
  saleLine,
  saleDraftTender,
  tillAudit,
} from "@shopper/db-sqlite";
import { addDraftTender, completeDraftSale } from "@shopper/core/till";
import { config } from "../../../support/till/basket";
import {
  add,
  at,
  ctx,
  expectChain,
  products,
  read,
  scope,
  session,
  withTill,
  world,
} from "../../../support/till/drafts";

test("a cash tender completes the draft once with change and a v4 outbox sale", async () => {
  await withTill(async (db) => {
    await world(db);
    const draft = await add(db, 0, {
      productId: products.ordinary.id,
      quantityThousandths: 1000,
    });
    await addDraftTender(db, ctx, {
      scope,
      expectedRevision: draft.draft?.revision ?? 0,
      at,
      kind: "cash",
      amount: 15_000,
    });

    const event = await completeDraftSale(db, config, session, {
      scope,
      expectedRevision: 2,
      at,
    });

    expect(event).toMatchObject({
      v: 5,
      type: "sale.recorded",
      sale: {
        total: 12_000,
        paid: 15_000,
        change: 3_000,
        tenders: [{ kind: "cash", amount: 15_000 }],
      },
    });
    expect(await read(db)).toMatchObject({ draft: null });
    expect(await db.read((tx) => tx.select().from(saleDraft))).toEqual([]);
    expect(await db.read((tx) => tx.select().from(saleDraftTender))).toEqual([]);
    expect(await db.read((tx) => tx.select().from(localSale))).toMatchObject([
      { id: event.sale.id, payload: event.sale },
    ]);
    expect(await db.read((tx) => tx.select().from(saleLine))).toHaveLength(1);
    expect(await db.read((tx) => tx.select().from(outbox))).toMatchObject([
      { event, localId: event.sale.localId },
    ]);
    const audits = await expectChain(db);
    expect(audits.map((row) => row.command)).toEqual([
      "till.reference.provision",
      "till.draft.add",
      "till.draft.tender.add",
      "sale.complete",
    ]);
    expect(await verifyChain(audits as AuditEntry[])).toMatchObject({ valid: true });
    expect(await db.read((tx) => tx.select().from(tillAudit))).toHaveLength(4);
  });
});

test("completion refuses an underpaid draft and keeps its rows and revision", async () => {
  await withTill(async (db) => {
    await world(db);
    const draft = await add(db, 0, {
      productId: products.ordinary.id,
      quantityThousandths: 1000,
    });
    const tendered = await addDraftTender(db, ctx, {
      scope,
      expectedRevision: draft.draft?.revision ?? 0,
      at,
      kind: "cash",
      amount: 5_000,
    });
    const before = {
      sales: await db.read((tx) => tx.select().from(localSale)),
      lines: await db.read((tx) => tx.select().from(saleLine)),
      outbox: await db.read((tx) => tx.select().from(outbox)),
      tenders: await db.read((tx) => tx.select().from(saleDraftTender)),
      audits: await expectChain(db),
    };

    await expect(
      completeDraftSale(db, config, session, {
        scope,
        expectedRevision: tendered.draft?.revision ?? 0,
        at,
      }),
    ).rejects.toThrow();

    expect(await read(db)).toMatchObject({ draft: { revision: 2 } });
    expect(await db.read((tx) => tx.select().from(localSale))).toEqual(before.sales);
    expect(await db.read((tx) => tx.select().from(saleLine))).toEqual(before.lines);
    expect(await db.read((tx) => tx.select().from(outbox))).toEqual(before.outbox);
    expect(await db.read((tx) => tx.select().from(saleDraftTender))).toEqual(before.tenders);
    expect(await expectChain(db)).toEqual(before.audits);
  });
});
