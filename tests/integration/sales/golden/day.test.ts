import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { asc, eq } from "drizzle-orm";
import { verifyChain, type AuditEntry } from "@shopper/audit";
import { sale, saleTender, stockMovement, auditLog } from "@shopper/db-pg";
import { localSale, outbox, saleDraft, tillAudit } from "@shopper/db-sqlite";
import { add, money, toDecimal } from "@shopper/money";
import { tradingDay } from "../../../fixtures/sales/golden/day";
import {
  expected,
  expected2dp,
  expected4dp,
  dayTotals,
  day2dp,
  day4dp,
  fields,
  taxAdjustments,
} from "../../../fixtures/sales/golden/expected";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { runGolden } from "../../../support/sales/golden/run";

let world: Awaited<ReturnType<typeof goldenWorld>>;
const day = fields.map(() => money(0));
beforeAll(async () => {
  world = await goldenWorld();
});
afterAll(async () => {
  await world?.local.close();
});

for (const [index, scenario] of tradingDay.entries()) {
  test(`golden trading day: ${scenario.name}`, async () => {
    const snapshot = await runGolden(world, scenario);
    if (!snapshot) {
      const voided = await world.local.read((tx) => tx.select().from(saleDraft));
      expect(voided).toMatchObject([{ status: "voided", voidReason: "Golden customer cancelled" }]);
      return;
    }
    const sum = (kind: "cash" | "momo" | "card") =>
      snapshot.tenders
        .filter((t) => t.kind === kind)
        .reduce((total, t) => add(total, t.amount), money(0));
    const values = [
      snapshot.totals.gross,
      snapshot.totals.base,
      snapshot.totals.nhil,
      snapshot.totals.getfund,
      snapshot.totals.vat,
      snapshot.cashRounding,
      sum("cash"),
      sum("momo"),
      sum("card"),
      snapshot.change,
    ];
    expect(values).toEqual(expected[index]);
    expect(snapshot.totals.covid).toBe(0);
    expect(snapshot.totals.roundingAdjustment).toBe(taxAdjustments[index]);
    expect(values.map((n) => toDecimal(n, 2)).join(" ")).toBe(expected2dp[index]);
    expect(values.map((n) => toDecimal(n, 4)).join(" ")).toBe(expected4dp[index]);
    values.forEach((n, i) => {
      day[i] = add(day[i], n);
    });
    const [saved] = await world.db.select().from(sale).where(eq(sale.id, snapshot.id));
    expect(saved?.storeSequence).not.toBeNull();
    expect(saved).toMatchObject({
      payload: snapshot,
      total: snapshot.total,
      cashRounding: snapshot.cashRounding,
      paid: snapshot.paid,
      change: snapshot.change,
      receipt: { v: 2, saleId: snapshot.id },
    });
    const tenders = await world.db
      .select()
      .from(saleTender)
      .where(eq(saleTender.saleId, snapshot.id));
    expect(tenders.map((t) => t.amount)).toEqual(snapshot.tenders.map((t) => t.amount));
    const movements = await world.db
      .select()
      .from(stockMovement)
      .where(eq(stockMovement.saleId, snapshot.id));
    expect(movements).toHaveLength(snapshot.lines.length);
    for (const line of snapshot.lines)
      expect(movements.find((m) => m.saleLineId === line.id)?.quantityThousandths).toBe(
        -line.tax.quantityThousandths,
      );
  });
}

test("golden trading day totals reconcile on both databases with intact audit chains", async () => {
  expect(day).toEqual(dayTotals);
  expect(day.map((n) => toDecimal(n, 2)).join(" ")).toBe(day2dp);
  expect(day.map((n) => toDecimal(n, 4)).join(" ")).toBe(day4dp);
  expect(await world.db.select().from(sale)).toHaveLength(20);
  expect(await world.local.read((tx) => tx.select().from(localSale))).toHaveLength(20);
  expect(await world.local.read((tx) => tx.select().from(outbox))).toHaveLength(20);
  const serverAudit = await world.db
    .select()
    .from(auditLog)
    .where(eq(auditLog.orgId, world.scope.orgId))
    .orderBy(asc(auditLog.chainSeq));
  const localAudit = await world.local.read((tx) =>
    tx.select().from(tillAudit).orderBy(asc(tillAudit.chainSeq)),
  );
  expect(serverAudit.filter((row) => row.command === "sale.accept")).toHaveLength(20);
  expect(localAudit.filter((row) => row.command === "sale.complete")).toHaveLength(20);
  expect(await verifyChain(serverAudit as AuditEntry[])).toMatchObject({ valid: true });
  expect(await verifyChain(localAudit as AuditEntry[])).toMatchObject({ valid: true });
});
