import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { asc, eq } from "drizzle-orm";
import { verifyChain, type AuditEntry } from "@shopper/audit";
import { v7 } from "uuid";
import { sale, saleTender, stockMovement, auditLog, deviceAudit } from "@shopper/db-pg";
import { verifyStream } from "@shopper/core/audit";
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
import { api, deviceId } from "../../../support/till/server";
import { syncHeaders } from "../../../support/till/requests";

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
      receipt: { v: 5, saleId: snapshot.id },
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

test("every command the golden day ran produced an audit row, and the till chain uploads intact", async () => {
  const serverAudit = await world.db
    .select()
    .from(auditLog)
    .where(eq(auditLog.orgId, world.scope.orgId));
  const localAudit = await world.local.read((tx) => tx.select().from(tillAudit));
  const named = (rows: { command: string; entityId: string | null }[], command: string) =>
    new Set(rows.filter((row) => row.command === command).map((row) => row.entityId));
  // Server: each accepted sale is named by its own sale.accept row, by its till-local id.
  const accepted = named(serverAudit, "sale.accept");
  const sales = await world.db.select().from(sale);
  expect(sales.map((row) => accepted.has(row.localId))).toEqual(sales.map(() => true));
  // Till: each completed sale and each draft the day opened is named by the command that made it.
  const completed = named(localAudit, "sale.complete");
  const local = await world.local.read((tx) => tx.select().from(localSale));
  expect(local.map((row) => completed.has(row.id))).toEqual(local.map(() => true));
  const drafted = named(localAudit, "till.draft.add");
  const drafts = await world.local.read((tx) => tx.select().from(saleDraft));
  expect(drafts.map((row) => drafted.has(row.id))).toEqual(drafts.map(() => true));
  // The till chain reaches the server row for row and verifies there as the register's stream.
  const chain = [...localAudit].sort((a, b) => a.chainSeq! - b.chainSeq!);
  for (let from = 0; from < chain.length; from += 200) {
    const response = await api.request("/sync/audit", {
      method: "POST",
      headers: syncHeaders(),
      body: JSON.stringify({ requestId: v7(), entries: chain.slice(from, from + 200) }),
    });
    expect(await response.json()).toMatchObject({ accepted: { head: expect.any(Object) } });
  }
  const stored = await world.db
    .select()
    .from(deviceAudit)
    .where(eq(deviceAudit.streamId, deviceId))
    .orderBy(asc(deviceAudit.chainSeq));
  expect(stored.map((row) => row.hash)).toEqual(chain.map((row) => row.hash));
  expect(await verifyStream(world.db, world.scope.orgId, deviceId)).toMatchObject({
    valid: true,
    count: chain.length,
  });
  expect(await verifyStream(world.db, world.scope.orgId, "org")).toMatchObject({ valid: true });
});
