import { expect, test } from "vite-plus/test";
import type { TillDatabase } from "@shopper/db-sqlite";
import {
  addDraftTender,
  completeDraftSale,
  holdDraftSale,
  registerReport,
  registerReportCsv,
  setDraftDiscount,
  voidDraftSale,
} from "@shopper/core/till";
import { config } from "../../../support/till/basket";
import { add, ctx, products, scope, session, withTill, world } from "../../../support/till/drafts";

type Tender = { kind: "cash" | "card"; amount: number };
const admin = {
  ...session,
  roleName: "Admin",
  issuedAt: "2025-12-31T00:00:00.000Z",
  expiresAt: "2026-01-02T00:00:00.000Z",
  permissions: ["sale.create", "sale.discount", "sale.void"],
};

async function sell(
  db: TillDatabase,
  time: string,
  line: { productId: string; quantityThousandths: number },
  tenders: Tender[],
  discount = 0,
) {
  const at = new Date(time);
  const now = { ...config, now: () => at };
  const view = await add(db, 0, line, { at });
  let revision = view.draft?.revision ?? 0;
  if (discount) {
    const lineId = view.draft?.lines[0]?.id ?? "";
    const next = await setDraftDiscount(db, ctx, {
      scope,
      expectedRevision: revision,
      at,
      session: admin,
      lineId,
      discount,
    });
    revision = next.draft?.revision ?? revision;
  }
  for (const tender of tenders) {
    await addDraftTender(db, ctx, {
      scope,
      expectedRevision: revision,
      at,
      ...tender,
      ...(tender.kind === "card" ? { approvalCode: "AB1234", last4: "4242" } : {}),
    });
    revision += 1;
  }
  return completeDraftSale(db, now, admin, { scope, expectedRevision: revision, at });
}
const ordinary = (quantityThousandths: number) => ({
  productId: products.ordinary.id,
  quantityThousandths,
});

async function goldenDay(db: TillDatabase) {
  await world(db);
  await sell(db, "2025-12-31T09:10:00.000Z", ordinary(1000), [{ kind: "cash", amount: 15_000 }]);
  await sell(db, "2025-12-31T09:50:00.000Z", ordinary(2000), [
    { kind: "card", amount: 10_000 },
    { kind: "cash", amount: 14_000 },
  ]);
  await sell(
    db,
    "2025-12-31T14:05:00.000Z",
    { productId: products.weighed.id, quantityThousandths: 500 },
    [{ kind: "card", amount: 15_000 }],
  );
  await sell(
    db,
    "2025-12-31T14:30:00.000Z",
    ordinary(1000),
    [{ kind: "cash", amount: 11_000 }],
    1_000,
  );
  await sell(db, "2026-01-01T00:10:00.000Z", ordinary(1000), [{ kind: "cash", amount: 12_000 }]);
}

test("the register report totals the golden day by tender, hour and top products to the last 1/10000 cedi", async () => {
  await withTill(async (db) => {
    await goldenDay(db);
    const report = await registerReport(db, { from: "2025-12-31", to: "2025-12-31" });
    expect(report.totals).toMatchObject({ sales: 62_000, transactions: 4, discounts: 1_000 });
    expect(report.totals.tax + report.totals.net).toBe(62_000);
    expect(report.totals.tax).toBeGreaterThan(0);
    expect(report.tenders).toEqual([
      { method: "cash", amount: 37_000 },
      { method: "card", amount: 25_000 },
    ]);
    expect(report.byHour).toHaveLength(24);
    expect(report.byHour.filter((h) => h.count)).toEqual([
      { hour: 9, amount: 36_000, count: 2 },
      { hour: 14, amount: 26_000, count: 2 },
    ]);
    expect(report.topProducts).toMatchObject([
      { productId: products.ordinary.id, quantityThousandths: 4000, amount: 47_000 },
      { productId: products.weighed.id, quantityThousandths: 500, amount: 15_000 },
    ]);
    expect(report.returns).toEqual({ count: 0, amount: 0 });
    expect(report.products).toBe(2);
    expect(report.discountedSales).toBe(1);
  });
});

test("held and voided drafts are excluded", async () => {
  await withTill(async (db) => {
    await world(db);
    await sell(db, "2025-12-31T09:10:00.000Z", ordinary(1000), [{ kind: "cash", amount: 12_000 }]);
    const at = new Date("2025-12-31T10:00:00.000Z");
    const held = await add(db, 0, ordinary(1000), { at });
    const parked = await holdDraftSale(db, ctx, {
      scope,
      expectedRevision: held.draft?.revision ?? 0,
      at,
    });
    const draft = await add(db, 0, ordinary(2000), { at });
    await voidDraftSale(db, ctx, {
      scope,
      expectedRevision: draft.draft?.revision ?? 0,
      at,
      session: admin,
      reason: "Changed mind",
    });
    expect(parked.draft?.status).toBe("held");
    const report = await registerReport(db, { from: "2025-12-31", to: "2025-12-31" });
    expect(report.totals).toMatchObject({ sales: 12_000, transactions: 1 });
  });
});

test("an empty day returns zeros", async () => {
  await withTill(async (db) => {
    await world(db);
    const report = await registerReport(db, { from: "2025-12-31", to: "2025-12-31" });
    expect(report.totals).toEqual({ sales: 0, transactions: 0, tax: 0, discounts: 0, net: 0 });
    expect(report.tenders).toEqual([]);
    expect(report.topProducts).toEqual([]);
    expect(report.byHour).toHaveLength(24);
    expect(report.byHour.every((h) => h.amount === 0 && h.count === 0)).toBe(true);
    expect(report.products).toBe(2);
  });
});

test("the report reads the UTC day (Accra, no DST)", async () => {
  await withTill(async (db) => {
    await goldenDay(db);
    const edge = await registerReport(db, { from: "2026-01-01", to: "2026-01-01" });
    expect(edge.totals).toMatchObject({ sales: 12_000, transactions: 1 });
    expect(edge.byHour.filter((h) => h.count)).toEqual([{ hour: 0, amount: 12_000, count: 1 }]);
  });
});

test("a range of days sums every day in it", async () => {
  await withTill(async (db) => {
    await goldenDay(db);
    const report = await registerReport(db, { from: "2025-12-30", to: "2026-01-01" });
    expect(report.totals).toMatchObject({ sales: 74_000, transactions: 5 });
    expect(report.tenders).toEqual([
      { method: "cash", amount: 49_000 },
      { method: "card", amount: 25_000 },
    ]);
  });
});

test("the CSV lists totals, tenders and top products with cedi amounts to 2 dp", async () => {
  await withTill(async (db) => {
    await goldenDay(db);
    const report = await registerReport(db, { from: "2025-12-31", to: "2025-12-31" });
    const csv = registerReportCsv(report).split("\n");
    expect(csv).toContain("Total sales,6.20");
    expect(csv).toContain("Transactions,4");
    expect(csv).toContain("Discounts,0.10");
    expect(csv).toContain("cash,3.70");
    expect(csv).toContain("card,2.50");
    expect(csv.some((row) => /^"?[^,]+"?,4.000,4.70$/.test(row))).toBe(true);
  });
});
