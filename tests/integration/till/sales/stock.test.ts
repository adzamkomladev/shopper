import { sql } from "drizzle-orm";
import { expect, test } from "vite-plus/test";
import { addDraftTender, completeDraftSale } from "@shopper/core/till";
import {
  localSale,
  outbox,
  saleDraft,
  saleDraftTender,
  saleLine,
  tillAudit,
  tillState,
} from "@shopper/db-sqlite";
import { config } from "../../../support/till/basket";
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

async function prepared(db: Parameters<typeof add>[0]) {
  await world(db);
  await add(db, 0, { productId: products.ordinary.id, quantityThousandths: 1000 });
  await addDraftTender(db, ctx, { scope, expectedRevision: 1, at, kind: "cash", amount: 15_000 });
}
const stockRows = (db: Parameters<typeof add>[0]) =>
  db.read((tx) => tx.all(sql.raw("SELECT * FROM stock_movement")));

async function snapshot(db: Parameters<typeof add>[0]) {
  return db.read(async (tx) => ({
    sales: await tx.select().from(localSale),
    lines: await tx.select().from(saleLine),
    outbox: await tx.select().from(outbox),
    drafts: await tx.select().from(saleDraft),
    tenders: await tx.select().from(saleDraftTender),
    state: await tx.select().from(tillState),
    audit: await tx.select().from(tillAudit),
    stock: await tx.all(sql.raw("SELECT * FROM stock_movement")),
  }));
}

test("completion records each sold quantity as a local stock movement", async () => {
  await withTill(async (db) => {
    await prepared(db);
    const event = await completeDraftSale(db, config, session, { scope, expectedRevision: 2, at });
    expect(await stockRows(db)).toMatchObject([
      {
        org_id: scope.orgId,
        device_id: scope.deviceId,
        branch_id: scope.branchId,
        product_id: products.ordinary.id,
        sale_id: event.sale.id,
        sale_line_id: event.sale.lines[0]?.id,
        quantity_thousandths: -1000,
        reason: "sale",
        occurred_at: at.toISOString(),
      },
    ]);
  });
});

test("an outbox failure rolls back completed sale, stock, receipt counter, draft and audit", async () => {
  await withTill(async (db) => {
    await prepared(db);
    const before = await snapshot(db);
    await db.read((tx) =>
      tx.run(
        sql.raw(
          "CREATE TRIGGER reject_completion BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT, 'completion failed'); END",
        ),
      ),
    );
    await expect(
      completeDraftSale(db, config, session, { scope, expectedRevision: 2, at }),
    ).rejects.toMatchObject({ cause: { message: "completion failed" } });
    expect(await snapshot(db)).toEqual(before);
    await db.read((tx) => tx.run(sql.raw("DROP TRIGGER reject_completion")));
    await completeDraftSale(db, config, session, { scope, expectedRevision: 2, at });
    expect(await stockRows(db)).toHaveLength(1);
  });
});

test("completion stores configured receipt names instead of scope identifiers", async () => {
  await withTill(async (db) => {
    await prepared(db);
    await completeDraftSale(
      db,
      { ...config, receiptReference: { orgName: "Shopper Market", deviceName: "Till One" } },
      session,
      { scope, expectedRevision: 2, at },
    );
    const [sale] = await db.read((tx) => tx.select().from(localSale));
    expect(sale?.receipt).toMatchObject({
      header: { org: "Shopper Market", device: "Till One", tin: null, address: null },
    });
  });
});
