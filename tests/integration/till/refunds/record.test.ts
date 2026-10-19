import { afterEach, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { refund as serverRefund } from "@shopper/db-pg";
import { refund as tillRefund, stockMovement } from "@shopper/db-sqlite";
import { refundShare } from "@shopper/tax";
import { api, databases } from "../../../support/till/server";
import { startHostUpstream } from "../../../support/till/host/upstream";
import {
  registerSettings,
  startPrinter,
  startRegister,
  type Printer,
  type Register,
} from "../../../support/hardware/host";

let register: Register | undefined;
let printer: Printer | undefined;
let upstream: Awaited<ReturnType<typeof startHostUpstream>> | undefined;
afterEach(async () => {
  await register?.close();
  await printer?.stop();
  await upstream?.close();
  register = printer = upstream = undefined;
});

async function start() {
  upstream = await startHostUpstream(api);
  upstream.setAvailable(false);
  register = await startRegister({ upstream: upstream.url });
  printer = await startPrinter();
  await register.configure(registerSettings(printer.port));
  const sale = await register.sell([{ kind: "cash", amount: 36_000 }], 3_000);
  await printer.waitForJobs(1);
  return { sale, lineId: sale.reply.event.sale.lines[0].id as string };
}
const refundRow = (id: string) =>
  register!.fixture.database.read((tx) =>
    tx.select().from(tillRefund).where(eq(tillRefund.id, id)),
  );

test("a partial cash refund records, returns stock, kicks the drawer and uploads only after the sale is acknowledged", async () => {
  const { sale, lineId } = await start();
  const reply = await register!.ask({
    type: "refund.record",
    saleId: sale.saleId,
    lines: [{ lineId, quantityThousandths: 1_000 }],
    reason: "Damaged",
    tender: { kind: "cash" },
  });
  expect(reply).toMatchObject({
    type: "result",
    kind: "refund",
    origin: "local",
    refund: { originalSaleId: sale.saleId, total: 12_000, tender: { kind: "cash" } },
    receipt: { kind: "refund", refundOf: sale.receipt.header.receiptNumber },
  });
  const id = reply.refund.id as string;

  const jobs = await printer!.waitForJobs(2);
  expect(jobs[1]!.page).toContain("REFUND");
  expect(jobs[1]!.kicks).toBe(1);

  const movements = await register!.fixture.database.read((tx) => tx.select().from(stockMovement));
  expect(movements.map((m) => [m.reason, m.quantityThousandths])).toEqual([
    ["sale", -3_000],
    ["return", 1_000],
  ]);
  expect(movements[1]).toMatchObject({ refundId: id });
  expect(await register!.audit("refund.record")).toHaveLength(1);

  // The sale is not acknowledged yet, so the refund has not been sent.
  expect(upstream!.requests.filter((r) => r.path === "/sync/refunds")).toEqual([]);
  expect((await refundRow(id))[0]).toMatchObject({ acceptedAt: null, origin: "local" });

  upstream!.setAvailable(true);
  await register!.ask({ type: "retry" });
  await expect
    .poll(async () => (await refundRow(id))[0]?.acceptedAt, { timeout: 20_000 })
    .toEqual(expect.any(String));

  const [saved] = await databases().db.select().from(serverRefund).where(eq(serverRefund.id, id));
  const original = sale.reply.event.sale.lines[0];
  expect(saved).toMatchObject({ originalSaleId: sale.saleId, gross: reply.refund.totals.gross });
  expect((saved!.payload as { lines: { tax: unknown }[] }).lines[0]!.tax).toEqual(
    reply.refund.lines[0].tax,
  );
  expect(reply.refund.lines[0].tax).toEqual(
    JSON.parse(JSON.stringify(refundShare(original.tax, 0, 1_000))),
  );
});

test("a card refund records its reference and leaves the drawer shut", async () => {
  const { sale, lineId } = await start();
  const reply = await register!.ask({
    type: "refund.record",
    saleId: sale.saleId,
    lines: [{ lineId, quantityThousandths: 500 }],
    reason: "Wrong size",
    tender: { kind: "card", reference: "CARD-9" },
  });
  expect(reply).toMatchObject({
    kind: "refund",
    refund: { tender: { kind: "card", reference: "CARD-9" } },
  });
  const jobs = await printer!.waitForJobs(2);
  expect(jobs[1]!.page).toContain("Refunded (Card CARD-9)");
  expect(jobs[1]!.kicks).toBe(0);
});
