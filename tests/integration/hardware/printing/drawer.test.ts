import { afterEach, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { saleDraftTender } from "@shopper/db-sqlite";
import {
  DRAWER_KICK,
  auditedSale,
  registerSettings,
  startPrinter,
  startRegister,
  type Printer,
  type Register,
} from "../../../support/hardware/host";

let register: Register | undefined;
let printer: Printer | undefined;
afterEach(async () => {
  await register?.close();
  await printer?.stop();
  register = printer = undefined;
});

async function setup(overrides: Record<string, unknown> = {}) {
  register = await startRegister();
  printer = await startPrinter();
  await register.configure(registerSettings(printer.port, overrides));
  return { register, printer };
}

test("a card-only sale prints the receipt without kicking the drawer", async () => {
  const { register, printer } = await setup();
  await register.sell([{ kind: "card", amount: 12_000 }]);
  const [job] = await printer.waitForJobs(1);
  expect(job?.page).toContain("TOTAL");
  expect(job?.kicks).toBe(0);
});

test("a cash sale kicks the drawer once in the same job as the receipt", async () => {
  const { register, printer } = await setup();
  await register.sell([{ kind: "cash", amount: 15_000 }]);
  const [job] = await printer.waitForJobs(1);
  expect(job?.page).toContain("TOTAL");
  expect(job?.commands.filter((command) => command.name === "drawer")).toEqual([DRAWER_KICK]);
});

test("a reprint carries the REPRINT banner, never kicks and is audited", async () => {
  const { register, printer } = await setup();
  const { saleId } = await register.sell([{ kind: "cash", amount: 12_000 }]);
  const [first] = await printer.waitForJobs(1);
  expect(first?.kicks).toBe(1);
  expect(await register.ask({ type: "receipt.print", saleId })).toMatchObject({ type: "result" });
  const [, second] = await printer.waitForJobs(2);
  expect(second?.page).toContain("*** REPRINT ***");
  expect(second?.page).toContain("TOTAL");
  expect(second?.kicks).toBe(0);
  expect(auditedSale(await register.audit("receipt.print"), saleId)).toHaveLength(1);
  expect(auditedSale(await register.audit("receipt.reprint"), saleId)).toHaveLength(1);
  expect(await register.receiptOutput(saleId)).toMatchObject({ reprints: 1 });
});

test("with automatic printing off a cash sale sends a kick-only job and a card sale sends nothing", async () => {
  const { register, printer } = await setup({ printAutomatically: false });
  const cash = await register.sell([{ kind: "cash", amount: 12_000 }]);
  const [kick] = await printer.waitForJobs(1);
  expect(kick?.commands).toEqual([{ name: "init" }, DRAWER_KICK]);
  expect(kick?.page.trim()).toBe("");

  const card = await register.sell([{ kind: "card", amount: 12_000 }]);
  expect(await register.ask({ type: "receipt.print", saleId: card.saleId })).toMatchObject({
    type: "result",
  });
  // The card sale printed nothing by itself: the only other job is the explicit reprint.
  const jobs = await printer.waitForJobs(2);
  expect(jobs[1]?.page).toContain("*** REPRINT ***");
  expect(jobs[1]?.kicks).toBe(0);
  expect(await register.receiptOutput(cash.saleId)).toMatchObject({ reprints: 0 });
});

test("a MoMo-only sale prints the receipt without kicking the drawer", async () => {
  const { register, printer } = await setup();
  const productId = register.fixture.config.references.products[0].id;
  const { view } = await register.ask({ type: "add", expectedRevision: 0, productId });
  const total = view.settlement?.total ?? view.quote.totals.gross;
  // The MoMo provider is covered by tests/integration/payments; here the confirmed tender is stored directly.
  await register.fixture.database.transaction((tx) =>
    tx.insert(saleDraftTender).values({
      id: v7(),
      orgId: register.fixture.config.identity.orgId,
      draftId: view.draft.id,
      position: 1,
      kind: "momo",
      amount: total,
      reference: v7(),
      phone: "0551234987",
      network: "mtn",
      status: "confirmed",
      createdAt: new Date().toISOString(),
    }),
  );
  const reply = await register.ask({ type: "sale.complete", expectedRevision: 1 });
  expect(reply).toMatchObject({ type: "result", kind: "sale" });
  const [job] = await printer.waitForJobs(1);
  expect(job?.page).toContain("TOTAL");
  expect(job?.kicks).toBe(0);
});
