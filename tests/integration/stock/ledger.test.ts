import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { asc, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { verifyChain, type AuditEntry } from "@shopper/audit";
import { auditLog, stockMovement } from "@shopper/db-pg";
import { onHand } from "@shopper/core/stock";
import { goldenWorld } from "../../support/sales/golden/setup";
import { runGolden } from "../../support/sales/golden/run";
import { tradingDay } from "../../fixtures/sales/golden/day";
import { products } from "../../fixtures/sales/golden/references";
import { ids } from "../../fixtures/sales/golden";
import { databases } from "../../support/till/server";
import { get, portalMember, portalOwner, type Portal } from "../../support/api/portal";
import { addSupplier, day } from "../../support/stock/seed";
import { send } from "../../support/stock/http";

// 08:00 receive Rice 24 @ 95 and Tomatoes 10.5 @ 280; 12:00 three golden Rice sales (21 on hand);
// 14:00 count Rice 20; 14:30 one more golden Rice sale;
// 15:00 the take is posted.
let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let clerk: string;
const rice = products.standard.id;
const tomatoes = products.weighed.id;
const takeId = v7();
const at = (time: string) => vi.setSystemTime(day(time));
const stock = async () =>
  (await get(owner.api, clerk, `/stock?branchId=${ids.branch}&limit=200`)).body.items as {
    productId: string;
    onHandThousandths: number;
  }[];

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  clerk = await portalMember(owner, "inventory");
});
afterAll(async () => {
  vi.useRealTimers();
  await world?.local.close();
});

test("Receive → sell → count → variance; stock on hand equals the fold of movements", async () => {
  const supplierId = await addSupplier("Ledger Supplies");
  vi.useFakeTimers({ toFake: ["Date"] });
  at("08:00");
  const receipt = await send(owner.api, clerk, "POST", "/stock/receipts", {
    id: v7(),
    branchId: ids.branch,
    supplierId,
    lines: [
      { productId: rice, quantityThousandths: 24_000, unitCost: 95_000 },
      { productId: tomatoes, quantityThousandths: 10_500, unitCost: 280_000 },
    ],
  });
  expect(receipt.status).toBe(201);
  vi.useRealTimers();
  for (const name of ["cash with change", "manual card", "line discount"])
    await runGolden(
      world,
      tradingDay.find((sale) => sale.name === name)!,
    );
  expect((await stock()).find((row) => row.productId === rice)!.onHandThousandths).toBe(21_000);

  vi.useFakeTimers({ toFake: ["Date"] });
  at("13:00");
  const started = await send(owner.api, clerk, "POST", "/stock/takes", {
    id: takeId,
    branchId: ids.branch,
    scope: "full",
  });
  expect(started.status).toBe(201);
  at("14:00");
  const counts = (await stock()).map(({ productId, onHandThousandths }) => ({
    productId,
    countedThousandths: productId === rice ? 20_000 : onHandThousandths,
  }));
  expect(
    (await send(owner.api, clerk, "PUT", `/stock/takes/${takeId}/counts`, { lines: counts }))
      .status,
  ).toBe(200);
  const open = await get(owner.api, clerk, `/stock/takes/${takeId}`);
  expect(open.body.lines.find((line: any) => line.productId === rice)).toMatchObject({
    countedThousandths: 20_000,
    expectedThousandths: 21_000,
    varianceThousandths: -1_000,
    varianceValue: -95_000,
  });

  vi.useRealTimers();
  await runGolden(
    world,
    tradingDay.find((sale) => sale.name === "cash with change")!,
    day("14:30"),
  );
  vi.useFakeTimers({ toFake: ["Date"] });
  at("15:00");
  const posted = await send(owner.api, clerk, "POST", `/stock/takes/${takeId}/post`);
  expect(posted.status).toBe(200);
  expect(posted.body.status).toBe("posted");
  expect(posted.body.lines.find((line: any) => line.productId === rice)).toMatchObject({
    expectedThousandths: 21_000,
    varianceThousandths: -1_000,
  });
  expect((await send(owner.api, clerk, "POST", `/stock/takes/${takeId}/post`)).status).toBe(409);
  vi.useRealTimers();

  // The count movement sits at 14:00, before the 14:30 sale, so on hand then was exactly the count.
  const { db } = databases();
  expect(
    (await onHand(db, ids.org, ids.branch, [{ productId: rice, at: day("14:00") }])).get(rice),
  ).toBe(20_000);
  const detail = await get(owner.api, clerk, `/stock/products/${rice}?branchId=${ids.branch}`);
  expect(detail.body.movements.slice(0, 2).map((m: any) => m.reason)).toEqual(["sale", "count"]);
  expect(detail.body.onHandThousandths).toBe(19_000);

  const folds = await db
    .select({
      productId: stockMovement.productId,
      total: sql<string>`SUM(${stockMovement.quantityThousandths})`,
    })
    .from(stockMovement)
    .where(eq(stockMovement.branchId, ids.branch))
    .groupBy(stockMovement.productId);
  const fold = new Map(folds.map((row) => [row.productId, Number(row.total)]));
  for (const row of await stock()) {
    expect(row.onHandThousandths, row.productId).toBe(fold.get(row.productId) ?? 0);
    const history = await get(
      owner.api,
      clerk,
      `/stock/products/${row.productId}?branchId=${ids.branch}`,
    );
    expect(history.body.movements[0]?.balanceThousandths ?? 0, row.productId).toBe(
      row.onHandThousandths,
    );
  }

  const audit = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.orgId, ids.org))
    .orderBy(asc(auditLog.chainSeq));
  const commands = audit.map((row) => row.command);
  for (const name of [
    "stock.receipt.record",
    "stock.take.start",
    "stock.take.count",
    "stock.take.post",
  ])
    expect(commands, name).toContain(name);
  expect(await verifyChain(audit as AuditEntry[])).toMatchObject({ valid: true });
});
