// The register report counts the distinct customers on a range's sales, and how many of them had already bought here.
import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { customerLookup } from "@shopper/db-sqlite";
import type { TillDatabase } from "@shopper/db-sqlite";
import {
  addDraftTender,
  attachDraftCustomer,
  completeDraftSale,
  registerReport,
} from "@shopper/core/till";
import { config } from "../../../support/till/basket";
import {
  add,
  ctx,
  ids,
  products,
  scope,
  session,
  withTill,
  world,
} from "../../../support/till/drafts";

const clerk = {
  ...session,
  issuedAt: "2025-12-30T00:00:00.000Z",
  expiresAt: "2026-01-03T00:00:00.000Z",
  permissions: [...session.permissions, "sale.create", "customer.read"],
};

async function customer(db: TillDatabase, name: string, phone: string) {
  const customerId = v7();
  await db.transaction((tx) =>
    tx.insert(customerLookup).values({
      orgId: ids.org,
      customerId,
      name,
      phone,
      kind: "individual",
      businessName: null,
      tin: null,
      version: 1,
    }),
  );
  return customerId;
}

/** A cash sale at `time` to `customerId`, or to a walk-in when it is null. */
async function sell(db: TillDatabase, time: string, customerId: string | null) {
  const at = new Date(time);
  const line = { productId: products.ordinary.id, quantityThousandths: 1000 };
  let revision = (await add(db, 0, line, { at })).draft?.revision ?? 0;
  if (customerId) {
    const attached = await attachDraftCustomer(db, ctx, {
      scope,
      session: clerk,
      at,
      expectedRevision: revision,
      customerId,
    });
    revision = attached.draft?.revision ?? revision;
  }
  const tendered = await addDraftTender(db, ctx, {
    scope,
    expectedRevision: revision,
    at,
    kind: "cash",
    amount: 15_000,
  });
  return completeDraftSale(db, { ...config, now: () => at }, clerk, {
    scope,
    expectedRevision: tendered.draft?.revision ?? revision,
    at,
  });
}

test("customers are the distinct names on the range's sales and returning ones bought here before it", async () => {
  await withTill(async (db) => {
    await world(db);
    const ama = await customer(db, "Ama Mensah", "0241234567");
    const kofi = await customer(db, "Kofi Boateng", "0249876543");
    await sell(db, "2025-12-31T09:10:00.000Z", ama);
    await sell(db, "2025-12-31T10:00:00.000Z", ama);
    await sell(db, "2026-01-01T00:10:00.000Z", ama);
    await sell(db, "2026-01-01T00:20:00.000Z", kofi);
    await sell(db, "2026-01-01T00:30:00.000Z", null);

    // Ama bought twice that day, and neither sale was earlier than the day itself.
    const first = await registerReport(db, { from: "2025-12-31", to: "2025-12-31" });
    expect(first).toMatchObject({ customers: 1, returningCustomers: 0 });
    expect(first.totals.transactions).toBe(2);

    // The next day Ama has an earlier sale and Kofi does not; the walk-in is nobody.
    const second = await registerReport(db, { from: "2026-01-01", to: "2026-01-01" });
    expect(second).toMatchObject({ customers: 2, returningCustomers: 1 });
    expect(second.totals.transactions).toBe(3);

    const both = await registerReport(db, { from: "2025-12-31", to: "2026-01-01" });
    expect(both).toMatchObject({ customers: 2, returningCustomers: 0 });
  });
});

test("a range with no customer sales counts none", async () => {
  await withTill(async (db) => {
    await world(db);
    await sell(db, "2025-12-31T09:10:00.000Z", null);
    expect(await registerReport(db, { from: "2025-12-31", to: "2025-12-31" })).toMatchObject({
      customers: 0,
      returningCustomers: 0,
    });
    expect(await registerReport(db, { from: "2025-12-30", to: "2025-12-30" })).toMatchObject({
      customers: 0,
      returningCustomers: 0,
    });
  });
});
