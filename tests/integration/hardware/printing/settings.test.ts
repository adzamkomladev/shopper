import { afterEach, expect, test } from "vite-plus/test";
import * as v from "valibot";
import { sql } from "drizzle-orm";
import { bridgeMessage } from "@shopper/sync/bridge";
import {
  DRAWER_KICK,
  freePort,
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

test("a fresh register reports the defaults from its enrolled identity at revision 0", async () => {
  register = await startRegister();
  const reply = await register.ask({ type: "status" });
  expect(v.safeParse(bridgeMessage, reply).success).toBe(true);
  expect(reply.status).toMatchObject({
    settings: {
      revision: 0,
      canEdit: true,
      value: {
        storeName: register.shopName,
        registerName: register.registerName,
        printAutomatically: true,
        paperMm: 80,
        clearCartAfterSale: true,
        requirePinForReturns: false,
        printer: null,
      },
    },
    printer: { state: "unconfigured", lastJob: null },
  });
  expect(reply.status.registerCode).toEqual(expect.any(String));
  expect(reply.status.registerCode).not.toBe("");
});

test("saving settings round-trips them, bumps the revision and tracks the printer state", async () => {
  register = await startRegister();
  printer = await startPrinter();
  const first = registerSettings(printer.port);
  expect(await register.save(first, 0)).toMatchObject({ type: "result" });
  expect((await register.status()).settings).toMatchObject({ revision: 1, value: first });
  expect((await register.status()).printer.state).toBe("ready");

  const second = registerSettings(null, { paperMm: 58, printAutomatically: false });
  expect(await register.save(second, 1)).toMatchObject({ type: "result" });
  const status = await register.status();
  expect(status.settings).toMatchObject({ revision: 2, value: second });
  expect(status.printer).toMatchObject({ state: "unconfigured", lastJob: null });
});

test("a save with a stale revision is REVISION_STALE and keeps the saved settings", async () => {
  register = await startRegister();
  const saved = registerSettings(null, { storeName: "First save" });
  expect(await register.save(saved, 0)).toMatchObject({ type: "result" });
  expect(await register.save(registerSettings(null, { storeName: "Stale" }), 0)).toMatchObject({
    type: "error",
    code: "REVISION_STALE",
  });
  expect((await register.status()).settings).toMatchObject({ revision: 1, value: saved });
  expect(await register.audit("till.settings.save")).toHaveLength(1);
});

test("a cashier without register.settings cannot save, test the printer or open the drawer", async () => {
  register = await startRegister({ permissions: [] });
  printer = await startPrinter();
  const status = await register.status();
  expect(status.settings).toMatchObject({ revision: 0, canEdit: false });
  for (const request of [
    { type: "settings.save", settings: registerSettings(printer.port), expectedRevision: 0 },
    { type: "printer.test" },
    { type: "drawer.test" },
  ])
    expect(await register.ask(request)).toMatchObject({ type: "error", code: "permission" });
  expect((await register.status()).settings.revision).toBe(0);
  expect(await register.audit("till.settings.save")).toHaveLength(0);
  expect(await printer.jobs()).toHaveLength(0);
});

test("saving settings audits the before and after documents", async () => {
  register = await startRegister();
  const settings = registerSettings(await freePort(), {
    storeName: "Audited Mart",
    requirePinForReturns: true,
  });
  expect(await register.save(settings, 0)).toMatchObject({ type: "result" });
  const [row, ...rest] = await register.audit("till.settings.save");
  expect(rest).toHaveLength(0);
  // The document may live in the before/after columns or in the payload; both read the same.
  const before = row?.before ?? row?.payload.before;
  const after = row?.after ?? row?.payload.after;
  expect(before).toMatchObject({ storeName: register.shopName, printer: null });
  expect(after).toMatchObject({ storeName: "Audited Mart", printer: settings.printer });
  // The shared redactor hides keys containing "pin", so the flag is also audited under a neutral name.
  expect(row?.payload.returnsNeedManagerApproval).toEqual({ before: false, after: true });
  expect(row?.actorId).toBe(register.fixture.config.session?.userId);
});

test("a printer test prints a page that names the configured printer model", async () => {
  register = await startRegister();
  printer = await startPrinter();
  await register.configure(
    registerSettings(printer.port, {
      printer: {
        model: "xprinter",
        connection: { kind: "network", host: "127.0.0.1", port: printer.port },
      },
    }),
  );
  expect(await register.ask({ type: "printer.test" })).toMatchObject({ type: "result" });
  const [job, ...rest] = await printer.waitForJobs(1);
  expect(rest).toHaveLength(0);
  expect(job?.page.toLowerCase()).toContain("xprinter");
  expect(job?.kicks).toBe(0);
  await expect
    .poll(async () => (await register!.status()).printer.lastJob)
    .toMatchObject({ kind: "test", saleId: null, outcome: "printed" });
});

test("a drawer test sends only the initialise and kick commands", async () => {
  register = await startRegister();
  printer = await startPrinter();
  await register.configure(registerSettings(printer.port));
  expect(await register.ask({ type: "drawer.test" })).toMatchObject({ type: "result" });
  const [job] = await printer.waitForJobs(1);
  expect(job?.commands).toEqual([{ name: "init" }, DRAWER_KICK]);
  expect(job?.page.trim()).toBe("");
});

test("a corrupt saved settings row never stops a sale; enrolled names apply", async () => {
  register = await startRegister();
  await register.configure(registerSettings(null, { storeName: "Before corruption" }));
  await register.fixture.database.transaction((tx) =>
    tx.run(sql`update till_setting set payload = '{"storeName": 5}'`),
  );
  const { receipt } = await register.sell([{ kind: "cash", amount: 15_000 }]);
  expect(receipt.header.branch).toBe("Osu branch");
  expect((await register.status()).settings).toMatchObject({
    revision: 0,
    value: { storeName: register.shopName },
  });
});
