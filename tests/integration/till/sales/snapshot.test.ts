import { asc } from "drizzle-orm";
import { expect, test } from "vite-plus/test";
import * as v from "valibot";
import { verifyChain } from "@shopper/audit";
import { openTillDatabase } from "@shopper/adapters-box/till";
import { saleEvent } from "@shopper/core/schemas";
import { hostSession, localSale, outbox, saleLine, tillAudit, tillState } from "@shopper/db-sqlite";
import { recordLocalSale, provisionTillReference } from "@shopper/core/till";
import {
  appVersion,
  config,
  context,
  goldenSale,
  ids,
  references,
  session,
  withDatabase,
} from "../../../support/till/sales";

const uuid7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const lines = [{ productId: ids.product, quantityThousandths: goldenSale.quantityThousandths }];

async function seed(db: ReturnType<typeof openTillDatabase>) {
  await provisionTillReference(db, context, references);
}

test("records a golden immutable sale and reopens it from SQLite", async () => {
  await withDatabase(async (path) => {
    let db = openTillDatabase(path);
    try {
      await seed(db);
      const event = await recordLocalSale(db, config, session, { lines });
      expect(v.safeParse(saleEvent, event).success).toBe(true);
      expect(event).toMatchObject({ v: 4, type: "sale.recorded" });
      expect(event.sale.id).toBe(event.sale.localId);
      expect(event.sale.id).toMatch(uuid7);
      expect(event.sale).toMatchObject({
        orgId: ids.org,
        deviceId: ids.device,
        storeId: config.storeId,
        branchId: ids.branch,
        cashierId: ids.cashier,
        sessionId: ids.session,
        appVersion,
        deviceTime: config.now().toISOString(),
      });
      expect(event.sale.lines).toHaveLength(1);
      expect(event.sale.lines[0]?.id).toMatch(uuid7);
      expect(event.sale.lines[0]).toMatchObject({
        productId: ids.product,
        priceId: ids.branchPrice,
        sku: "MILK-001",
        name: "Fresh milk",
        baseUnit: "each",
        tax: {
          on: goldenSale.on,
          taxClass: "standard",
          priceMode: "inclusive",
          quantityThousandths: goldenSale.quantityThousandths,
          unitPrice: goldenSale.unitPrice,
          ...goldenSale.line,
          rule: {
            id: ids.oldTax,
            effectiveFrom: "2025-01-01",
            vatBps: 1_500,
            nhilBps: 250,
            getfundBps: 250,
            covidBps: 0,
          },
        },
      });
      expect(event.sale.totals).toEqual(goldenSale.totals);

      const persisted = await db.read(async (tx) => ({
        sales: await tx.select().from(localSale),
        lines: await tx.select().from(saleLine),
        queue: await tx.select().from(outbox),
        state: await tx.select().from(tillState),
        sessions: await tx.select().from(hostSession),
        audits: await tx.select().from(tillAudit).orderBy(asc(tillAudit.chainSeq)),
      }));
      expect(persisted.sales).toHaveLength(1);
      expect(persisted.sales[0]).toMatchObject({
        localId: event.sale.localId,
        payload: event.sale,
      });
      expect(persisted.lines).toHaveLength(1);
      expect(persisted.lines[0]).toMatchObject({
        saleId: event.sale.id,
        payload: event.sale.lines[0],
      });
      expect(persisted.queue).toHaveLength(1);
      expect(persisted.queue[0]).toMatchObject({ localId: event.sale.localId, localSeq: 1, event });
      expect(persisted.state[0]?.lastOutboxSeq).toBe(1);
      expect(persisted.sessions[0]).toMatchObject({ id: ids.session, proof: session.proof });
      expect(JSON.stringify({ ...persisted, sessions: [] })).not.toContain(session.proof);
      expect(await verifyChain(persisted.audits)).toMatchObject({
        valid: true,
        count: persisted.audits.length,
      });
      await db.close();

      db = openTillDatabase(path);
      const reopened = await db.read(async (tx) => ({
        sales: await tx.select().from(localSale),
        queue: await tx.select().from(outbox),
        state: await tx.select().from(tillState),
      }));
      expect(reopened.sales[0]?.payload).toEqual(event.sale);
      expect(reopened.queue[0]?.event).toEqual(event);
      expect(reopened.state[0]?.lastOutboxSeq).toBe(1);
    } finally {
      await db.close();
    }
  });
});

test("uses the effective Ghana tax rule on each sale date", async () => {
  await withDatabase(async (path) => {
    const db = openTillDatabase(path);
    try {
      await seed(db);
      const event = await recordLocalSale(
        db,
        {
          ...config,
          now: () => new Date("2026-01-01T00:30:00.000Z"),
        },
        session,
        { lines },
      );
      expect(event.sale.deviceTime).toBe("2026-01-01T00:30:00.000Z");
      expect(event.sale.lines[0]?.tax).toMatchObject({
        on: "2026-01-01",
        unitPrice: 12_000,
        base: 16_364,
        vat: 1_636,
        nhil: 0,
        getfund: 0,
        covid: 0,
        gross: 18_000,
        roundingAdjustment: 0,
        rule: { id: ids.currentTax, effectiveFrom: "2026-01-01", vatBps: 1_000 },
      });
    } finally {
      await db.close();
    }
  });
});
