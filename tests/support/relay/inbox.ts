// A relay org with paid online orders (the real order and payment workflows) and its box: a second database holding
// the same store, branches, catalogue and prices with the same ids, as the Publisher would have left them (v1.5 Day 50).
//   const w = await inboxWorld()
//   w.f                      -> the relay side: fulfilWorld (f.paid(), f.ctx, f.world.db, f.world.sent, ...)
//   w.box / w.ctx            -> the box database and a command context for its staff
//   w.run(intercept?)        -> one Publisher run on the box against the relay (pull, decide, publish, push, beat)
//   w.stock(productId, units) -> moves the box's on hand at the main branch
//   w.boxOrder(id) / w.relayOrder(id) / w.boxHolds(id) / w.events(db, id)
import { and, eq, isNull, sql } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { createApi } from "@shopper/api";
import { buildInfo } from "@shopper/config";
import { generateKey, issueLicence, signedRequest } from "@shopper/core/licence";
import { enrolRelay, publishPending } from "@shopper/core/relay";
import { availableOf } from "@shopper/core/stock";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { emptyDatabase } from "../migration/archive";
import { fulfilWorld } from "../orders/fulfil";

type Send = (path: string, init: { method: string; body?: string }) => Promise<Response>;

export async function inboxWorld() {
  const f = await fulfilWorld({ acceptWithinMs: 600_000, pickLeadMs: 0 });
  const orgId = f.world.a.orgId;
  const relayDb = f.world.db;
  await relayDb.update(schema.org).set({ mode: "relay" }).where(eq(schema.org.id, orgId));
  const issuer = await generateKey();
  const key = await generateKey();
  const licence = await issueLicence(issuer.privateKey, {
    id: v7(),
    org: orgId,
    site: "Osu Mart",
    machine: "b".repeat(64),
    key: key.publicKey,
    terminals: 5,
    issuedAt: new Date().toISOString(),
    maintenanceUntil: "2099-12-31",
  });
  await enrolRelay(
    relayDb,
    { orgId: f.world.b.orgId, appVersion: "test" },
    { licence, onlineOrders: true, metadata: buildInfo },
  );
  // The box beat just now: its branches take orders (Day 49 pauses a silent box's).
  await relayDb
    .update(schema.relayBox)
    .set({ lastSeenAt: new Date() })
    .where(eq(schema.relayBox.orgId, orgId));
  const api = createApi({
    database: relayDb,
    licenceSigningKey: issuer.privateKey,
    orderFlows: f.flows,
    notifications: f.world.queue,
  });
  const relay: Send = async (path, init) =>
    api.fetch(
      await signedRequest({ licence, key: key.privateKey }, `https://cloud.test${path}`, init),
    );

  const box = await emptyDatabase();
  const ctx = provisioningContext(orgId);
  await provisionOrg(box.db, ctx, { name: "Osu Mart", slug: `box-${Date.now().toString(36)}` });
  const [settings] = await relayDb.select().from(schema.org).where(eq(schema.org.id, orgId));
  await box.db
    .update(schema.org)
    .set({
      tin: settings!.tin,
      vatRegisteredFrom: settings!.vatRegisteredFrom,
      priceMode: settings!.priceMode,
      onlineOrders: true,
    })
    .where(eq(schema.org.id, orgId));
  const copy = async (
    table:
      | typeof schema.store
      | typeof schema.branch
      | typeof schema.category
      | typeof schema.price
      | typeof schema.branchFulfilment,
  ) => {
    const rows = await relayDb
      .select()
      .from(table as never)
      .where(sql`org_id = ${orgId}`);
    if (rows.length) await box.db.insert(table as never).values(rows as never);
  };
  await copy(schema.store);
  await copy(schema.branch);
  await copy(schema.category);
  const relayClasses = await relayDb
    .select()
    .from(schema.taxClass)
    .where(eq(schema.taxClass.orgId, orgId));
  const boxClasses = await box.db
    .select()
    .from(schema.taxClass)
    .where(eq(schema.taxClass.orgId, orgId));
  const products = await relayDb
    .select()
    .from(schema.product)
    .where(eq(schema.product.orgId, orgId));
  await box.db.insert(schema.product).values(
    products.map((row) => ({
      ...row,
      taxClassId: boxClasses.find(
        (c) => c.code === relayClasses.find((r) => r.id === row.taxClassId)!.code,
      )!.id,
    })),
  );
  await copy(schema.price);
  await copy(schema.branchFulfilment);
  const main = f.shop.branches[0];

  const stock = (productId: string, units: number) =>
    box.db.insert(schema.stockMovement).values({
      orgId,
      branchId: main,
      productId,
      reason: "adjustment",
      quantityThousandths: units * 1000,
      occurredAt: new Date(Date.now() - 60_000),
    });
  const run = (intercept?: (path: string) => Response | undefined) =>
    publishPending(box.db, ctx, {
      send: async (path, init) => intercept?.(path) ?? relay(path, init),
    });
  const order = (db: schema.ShopperDatabase) => async (id: string) =>
    (await db.select().from(schema.onlineOrder).where(eq(schema.onlineOrder.id, id)))[0];
  const available = (db: schema.ShopperDatabase) => async (productId: string) => {
    const [row] = await db
      .select({ available: availableOf(orgId, main, sql`${schema.product.id}`, new Date()) })
      .from(schema.product)
      .where(and(eq(schema.product.orgId, orgId), eq(schema.product.id, productId)));
    return row!.available;
  };
  return {
    f,
    orgId,
    main,
    box: box.db,
    ctx,
    relay,
    run,
    stock,
    boxOrder: order(box.db),
    relayOrder: order(relayDb),
    boxAvailable: available(box.db),
    relayAvailable: available(relayDb),
    boxHolds: (id: string) =>
      box.db
        .select()
        .from(schema.stockHold)
        .where(and(eq(schema.stockHold.orderId, id), isNull(schema.stockHold.releasedAt))),
    events: async (db: schema.ShopperDatabase, id: string) =>
      (
        await db
          .select({ status: schema.onlineOrderEvent.status })
          .from(schema.onlineOrderEvent)
          .where(eq(schema.onlineOrderEvent.orderId, id))
      ).map((row) => row.status),
    async close() {
      await box.close();
      await f.close();
    },
  };
}
