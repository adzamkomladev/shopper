// Every VAT invoice the server accepts becomes a pending fiscal document in the same transaction, and is queued on its
// store's lane; a replayed upload never makes a second document, and a shop that is not VAT-registered makes none.
import { afterAll, beforeAll, beforeEach, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as v from "valibot";
import { fiscalDoc, sale as serverSale } from "@shopper/db-pg";
import { fiscalPayload } from "@shopper/core/receipts";
import { receiptDocument } from "@shopper/core/schemas";
import { setTaxSettings } from "@shopper/core/tax";
import type { GoldenSale } from "../../fixtures/sales/golden/types";
import { goldenWorld } from "../../support/sales/golden/setup";
import { ringGolden, runGolden } from "../../support/sales/golden/run";
import { pushEvents } from "../../support/till/requests";
import { api } from "../../support/till/server";
import { enqueued } from "../../support/fiscal/lane";

const scenario: GoldenSale = {
  name: "fiscal invoice",
  lines: [{ product: "standard", quantity: 2_000 }],
  tenders: [{ kind: "cash", amount: 500_000 }],
};
let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld();
});
afterAll(async () => {
  await world?.local.close();
});
beforeEach(() => void (enqueued.length = 0));

const docsFor = (saleId: string) =>
  world.db.select().from(fiscalDoc).where(eq(fiscalDoc.saleId, saleId));

test("an accepted VAT invoice becomes one pending invoice document, queued on its store's lane", async () => {
  const sold = (await runGolden(world, scenario))!;
  const [saved] = await world.db.select().from(serverSale).where(eq(serverSale.id, sold.id));
  const receipt = v.parse(receiptDocument, saved!.receipt);
  expect(receipt.header.vatInvoice).toBe(true);

  const docs = await docsFor(sold.id);
  expect(docs).toHaveLength(1);
  expect(docs[0]).toMatchObject({
    orgId: sold.orgId,
    storeId: sold.storeId,
    branchId: sold.branchId,
    kind: "invoice",
    refundId: null,
    invoiceNumber: sold.receiptNumber,
    status: "pending",
    attempts: 0,
  });
  expect(docs[0]!.payload).toEqual(JSON.parse(JSON.stringify(fiscalPayload(receipt))));
  expect(enqueued).toEqual([{ orgId: sold.orgId, storeId: sold.storeId, docId: docs[0]!.id }]);
});

test("a replayed upload makes no second document and queues the same one again", async () => {
  const event = (await ringGolden(world, scenario))!;
  const sessions = [{ sessionId: world.session.id, proof: world.session.proof }];
  for (let i = 0; i < 2; i++) expect((await pushEvents(api, [event], sessions)).status).toBe(200);
  const docs = await docsFor(event.sale.id);
  expect(docs).toHaveLength(1);
  expect(enqueued.map((call) => call.docId)).toEqual([docs[0]!.id, docs[0]!.id]);
});

test("a shop that is not VAT-registered makes no fiscal document and queues nothing", async () => {
  const settings = {
    tin: null,
    vatRegisteredFrom: null,
    priceMode: "inclusive",
    cashRounding: "10p",
  };
  await setTaxSettings(
    world.db,
    { ...world.command, actorId: world.session.userId },
    {
      body: settings,
    },
  );
  try {
    const event = (await ringGolden(world, {
      ...scenario,
      settings: { vatRegisteredFrom: null },
    }))!;
    const sessions = [{ sessionId: world.session.id, proof: world.session.proof }];
    expect(await (await pushEvents(api, [event], sessions)).json()).toMatchObject({
      rejected: [],
    });
    const [saved] = await world.db
      .select()
      .from(serverSale)
      .where(eq(serverSale.id, event.sale.id));
    expect(v.parse(receiptDocument, saved!.receipt).header.vatInvoice).toBe(false);
    expect(await docsFor(event.sale.id)).toEqual([]);
    expect(enqueued).toEqual([]);
  } finally {
    await setTaxSettings(
      world.db,
      { ...world.command, actorId: world.session.userId },
      {
        body: { ...settings, tin: "C0000000001", vatRegisteredFrom: "2000-01-01" },
      },
    );
  }
});
