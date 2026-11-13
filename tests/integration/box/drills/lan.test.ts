// Notion Day 40 milestone: a sealed box runs a shop with no internet. The box has no route out for the whole drill
// (every outbound call goes to a proxy that hangs up). A register fresh from the installer enrols over the LAN with a
// one-time code, a cashier signs in on the box, sells to the printer and drawer, and runs a shift with a refund to a
// printed Z-report. The box ends up holding every sale, the refund and the Z, each once.
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { org, refund, sale, shift } from "@shopper/db-pg";
import { context, databases, devices, principal } from "../../../support/till/server";
import { ids } from "../../../support/till/sales";
import { startTillHost } from "../../../support/till/host/process";
import { waitForDrained } from "../../../support/till/host/chaos";
import { denominate } from "../../../support/till/close";
import { registerSettings, startPrinter, type Printer } from "../../../support/hardware/host";
import { drillBox } from "../../../support/box/drill";
import { grantCashier, setCashierPassword, unplugInternet } from "../../../support/box/lan";

type Host = Awaited<ReturnType<typeof startTillHost>>;
// Bridge replies as the hardware suites read them (tests/support/hardware/host.ts).
type Reply = Record<string, any>;

const float = 1_000_000;
let internet: Awaited<ReturnType<typeof unplugInternet>>;
let box: Awaited<ReturnType<typeof drillBox>>;
let printer: Printer;
let folder: string;
let host: Host | undefined;
let revoke: (() => Promise<unknown>) | undefined;
beforeAll(async () => {
  internet = await unplugInternet();
  box = await drillBox(internet.env);
  printer = await startPrinter();
  folder = await mkdtemp(join(tmpdir(), "shopper-lan-"));
}, 300_000);
afterAll(async () => {
  await revoke?.();
  await host?.stop();
  await printer?.stop();
  await box?.close();
  await internet?.close();
  if (folder) await rm(folder, { recursive: true, force: true });
});

// The control: the box is a Bun binary, and Bun's fetch with the box's environment cannot reach the internet.
test("the box's environment has no route to the internet", async () => {
  const { stdout } = await promisify(execFile)(
    "bun",
    [
      "-e",
      'fetch("https://api.paystack.co/").then(() => console.log("reached"), () => console.log("refused"))',
    ],
    { env: { ...process.env, ...internet.env } },
  );
  expect(stdout.trim()).toBe("refused");
  expect(internet.attempts).toContain("CONNECT api.paystack.co:443 HTTP/1.1");
  internet.attempts.length = 0;
});

test("a register fresh from the installer enrols with the box, signs in on it and sells to the printer", async () => {
  const install = {
    sqlitePath: join(folder, "till.sqlite"),
    plaintext: true,
    upstream: box.upstream,
    origins: ["http://127.0.0.1:5184"],
    port: 0,
  };
  host = await startTillHost(install);
  const challenge = await devices.issueEnrollment(principal, { branchId: ids.branch });
  const enrolled = host.waitForMessage((message) => message.type === "enrolled");
  expect(
    await host.request({
      type: "device.enrol",
      shopCode: await shopCode(),
      code: challenge.code,
      name: "Box till",
    }),
  ).toMatchObject({ type: "result", kind: "enrolled" });
  const ready = host.waitForMessage((message) => message.type === "ready", 60_000);
  host.child.send({
    type: "start",
    config: { ...install, ...((await enrolled).registration as object), session: null },
  });
  await ready;

  // The cashier's sign-in is checked by the box, not cached: offline would mean the box was never asked. The owner
  // has let cashiers set up the register's printer.
  revoke = await grantCashier("register.settings");
  await setCashierPassword(principal.userId, "lan drill password");
  expect(
    await host.request({
      type: "session.signIn",
      email: "sync-cashier@test.invalid",
      password: "lan drill password",
    }),
  ).toMatchObject({ status: { user: { offline: false } } });
  const status = (await host.request({ type: "status" })) as Reply;
  expect(
    await host.request({
      type: "settings.save",
      settings: registerSettings(printer.port),
      expectedRevision: status.status.settings.revision,
    }),
  ).toMatchObject({ type: "result" });

  expect(await host.request({ type: "shift.open", float })).toMatchObject({ type: "result" });
  const first = await ring(host, [{ kind: "cash", amount: 20_000 }]);
  // Opening the shift opens the drawer for the float; the cash sale prints its receipt with the number the till
  // issued and opens the drawer once, in the same job.
  const [opened, printed] = await printer.waitForJobs(2);
  expect(opened!.kicks).toBe(1);
  expect(printed!.page).toContain(first.receipt.header.receiptNumber);
  expect(printed!.kicks).toBe(1);
  await waitForDrained(host, 60_000);
  expect(await onBox(first.saleId)).toMatchObject({
    receiptNumber: first.receipt.header.receiptNumber,
  });
}, 300_000);

test("with no internet the shift runs to a printed Z-report, and the box holds all of it", async () => {
  if (!host) throw new Error("The register did not enrol");
  const sales = [await ring(host, [{ kind: "cash", amount: 12_000 }])];
  for (let index = 0; index < 8; index++)
    sales.push(
      await ring(host, [
        index % 2 ? { kind: "card", amount: 12_000 } : { kind: "cash", amount: 12_000 },
      ]),
    );
  sales.push(
    await ring(host, [
      { kind: "cash", amount: 5_000 },
      { kind: "card", amount: 7_000 },
    ]),
  );
  const returned = sales[0]!;
  expect(
    await host.request({
      type: "refund.record",
      saleId: returned.saleId,
      lines: [{ lineId: returned.reply.event.sale.lines[0].id, quantityThousandths: 1_000 }],
      reason: "Damaged pack",
      tender: { kind: "cash" },
    }),
  ).toMatchObject({ type: "result", kind: "refund" });

  // Counted exactly what the drawer should hold: the float, cash taken net of change, less the cash refund (the first
  // test's sale included); card is the card slips. A Z with no variance is a Z whose sums are right.
  const cash = float + 12_000 + 12_000 + 4 * 12_000 + 5_000 - 12_000;
  const card = 4 * 12_000 + 7_000;
  const declared = (await host.request({
    type: "shift.declare",
    counts: denominate(cash),
    card,
    momo: 0,
  })) as Reply;
  expect(declared).toMatchObject({
    kind: "shiftDeclared",
    variances: [
      { tender: "cash", expected: cash, variance: 0 },
      { tender: "card", expected: card, variance: 0 },
      { tender: "momo", expected: 0, variance: 0 },
    ],
    approvalRequired: false,
    closed: { printed: true, report: { kind: "z" } },
  });
  const z = declared.closed.report;
  await expect
    .poll(async () => (await printer.jobs()).at(-1)?.page ?? "", { timeout: 15_000 })
    .toContain("Z REPORT");

  await waitForDrained(host, 120_000);
  const { db } = databases();
  for (const { saleId } of sales) expect(await onBox(saleId)).toBeDefined();
  // Refunds upload on their own worker, not the sale outbox.
  await expect
    .poll(
      () =>
        db.select({ id: refund.id }).from(refund).where(eq(refund.originalSaleId, returned.saleId)),
      { timeout: 60_000, interval: 250 },
    )
    .toHaveLength(1);
  // The Z uploads on its own worker too; the box keeps the till's sums, which match what was counted.
  await expect
    .poll(
      () =>
        db
          .select({ expectedCash: shift.expectedCash, declaredCash: shift.declaredCash })
          .from(shift)
          .where(and(eq(shift.orgId, context.orgId), eq(shift.id, z.shiftId))),
      { timeout: 60_000, interval: 250 },
    )
    .toEqual([{ expectedCash: cash, declaredCash: cash }]);
  // Nothing the shop did needed the internet: the box never tried to reach it (the control shows it would show here).
  expect(internet.attempts).toEqual([]);
}, 300_000);

/** Fills the basket with the suite's product, tenders it and completes the sale, as the till screen does. */
async function ring(register: Host, tenders: Array<{ kind: "cash" | "card"; amount: number }>) {
  await register.request({
    type: "add",
    expectedRevision: 0,
    productId: ids.product,
    quantityThousandths: 1_000,
  });
  let revision = 1;
  for (const tender of tenders) {
    const card = tender.kind === "card" ? { approvalCode: "ABC123", last4: "1234" } : {};
    expect(
      await register.request({
        type: "tender.add",
        expectedRevision: revision,
        ...tender,
        ...card,
      }),
    ).toMatchObject({ kind: "draft" });
    revision += 1;
  }
  const reply = (await register.request({
    type: "sale.complete",
    expectedRevision: revision,
  })) as Reply;
  expect(reply).toMatchObject({ type: "result", kind: "sale" });
  return { saleId: reply.event.sale.id as string, reply, receipt: reply.receipt };
}

async function onBox(saleId: string) {
  const [row] = await databases()
    .db.select({ receiptNumber: sale.receiptNumber })
    .from(sale)
    .where(and(eq(sale.orgId, context.orgId), eq(sale.id, saleId)));
  return row;
}

async function shopCode() {
  const [row] = await databases()
    .db.select({ slug: org.slug })
    .from(org)
    .where(eq(org.id, context.orgId));
  return row!.slug;
}
