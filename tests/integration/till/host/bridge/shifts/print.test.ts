// The Z is saved before it prints. A printer that is down or missing gives printed: false (the close still stands) and
// shift.print reprints the stored Z later; shift.print also prints the X. drawer.test is now an audited no-sale.
import { afterEach, expect, test } from "vite-plus/test";
import { manager, pin, startShifter, type Shifter } from "../../../../../support/till/host/shifts";

let shifter: Shifter | undefined;
afterEach(async () => {
  await shifter?.close();
  shifter = undefined;
});

const float = 2_000_000;

test("a printer that is down at the close gives printed: false, keeps the Z and reprints it later", async () => {
  shifter = await startShifter({ printer: "down" });
  const { register } = shifter;
  const declared = await shifter.declare(float);
  expect(declared).toMatchObject({
    type: "result",
    kind: "shiftDeclared",
    approvalRequired: false,
    closed: { printed: false, report: { kind: "z" } },
  });
  const { shift } = await register.status();
  expect(shift.current).toBeNull();
  expect(shift.last).toMatchObject({ id: declared.closed.report.shiftId, upload: "pending" });
  expect(await register.audit("shift.close")).toHaveLength(1);

  expect(await register.ask({ type: "shift.print", shiftId: shift.last.id })).toMatchObject({
    type: "error",
    code: "PRINTER_OFFLINE",
  });
  const printer = await shifter.restore();
  expect(await register.ask({ type: "shift.print", shiftId: shift.last.id })).toMatchObject({
    type: "result",
    kind: "status",
  });
  const [job, ...rest] = await printer.waitForJobs(1);
  expect(rest).toHaveLength(0);
  expect(job?.page).toContain("Z REPORT");
  expect(job?.page).toContain("Audit anchor");
  // Each attempt is audited (the failed one too); the reprint names the shift.
  expect((await register.audit("shift.print")).at(-1)).toMatchObject({ entityId: shift.last.id });
});

test("a register with no printer closes with printed: false", async () => {
  shifter = await startShifter({ printer: "none" });
  expect(await shifter.declare(float)).toMatchObject({
    closed: { printed: false, report: { kind: "z" } },
  });
  expect((await shifter.register.status()).shift.last).toMatchObject({ upload: "pending" });
});

test("a manager's close with the printer down is shiftClosed with printed: false", async () => {
  shifter = await startShifter({ printer: "down" });
  const { register } = shifter;
  await shifter.syncApprover();
  await shifter.declare(float - 60_000);
  expect(
    await register.ask({ type: "shift.close", approval: { approverId: manager, pin } }),
  ).toMatchObject({ type: "result", kind: "shiftClosed", printed: false });
  expect((await register.status()).shift.last).not.toBeNull();
});

test("shift.print without a shift id prints the X, which says it is not a close, and is audited", async () => {
  shifter = await startShifter();
  const { register, printer } = shifter;
  expect(await register.ask({ type: "shift.print" })).toMatchObject({
    type: "result",
    kind: "status",
  });
  const [job] = await printer.waitForJobs(1);
  expect(job?.page).toContain("X REPORT");
  expect(job?.page).toContain("not a close");
  expect(job?.page).not.toContain("Audit anchor");
  expect((await register.status()).shift.current).toMatchObject({ status: "open" });
  expect(await register.audit("shift.print")).toHaveLength(1);
});

test("printing the X needs report.read and printing a stored Z needs shift.read", async () => {
  shifter = await startShifter({ permissions: ["register.settings"] });
  const { register } = shifter;
  expect(await register.ask({ type: "shift.print" })).toMatchObject({
    type: "error",
    code: "permission",
  });
  const declared = await shifter.declare(float);
  // The cashier role holds shift.read, so the Z reprints without report.read.
  expect(
    await register.ask({ type: "shift.print", shiftId: declared.closed.report.shiftId }),
  ).toMatchObject({ type: "result", kind: "status" });
  expect(await shifter.printer.waitForJobs(2)).toHaveLength(2);
});

test("the X with the printer down is PRINTER_OFFLINE", async () => {
  shifter = await startShifter({ printer: "down" });
  expect(await shifter.register.ask({ type: "shift.print" })).toMatchObject({
    type: "error",
    code: "PRINTER_OFFLINE",
  });
});

test("the drawer test records an audited no-sale named 'Drawer test' and opens the drawer", async () => {
  shifter = await startShifter();
  const { register, printer } = shifter;
  expect(await register.ask({ type: "drawer.test" })).toMatchObject({
    type: "result",
    kind: "status",
  });
  const [job, ...rest] = await printer.waitForJobs(1);
  expect(rest).toHaveLength(0);
  expect(job?.kicks).toBe(1);
  expect(await register.audit("shift.nosale")).toMatchObject([
    { payload: { reason: "Drawer test" } },
  ]);
  expect(await register.ask({ type: "shift.report" })).toMatchObject({
    report: { movements: [{ kind: "no_sale", reason: "Drawer test" }] },
  });
});

test("the drawer test on a register with no shift is SHIFT_REQUIRED and the drawer stays shut", async () => {
  shifter = await startShifter({ shift: false });
  const { register } = shifter;
  expect(await register.ask({ type: "drawer.test" })).toMatchObject({
    type: "error",
    code: "SHIFT_REQUIRED",
  });
  expect(await shifter.jobs()).toHaveLength(0);
  expect(await register.audit("shift.nosale")).toHaveLength(0);
});

test("selling on a register with no shift is SHIFT_REQUIRED", async () => {
  shifter = await startShifter({ shift: false });
  const { register } = shifter;
  const added = await register.ask({
    type: "add",
    expectedRevision: 0,
    productId: register.fixture.config.references.products[0].id,
  });
  expect(added).toMatchObject({ type: "result", kind: "draft" });
  expect(
    await register.ask({ type: "tender.add", expectedRevision: 1, kind: "cash", amount: 20_000 }),
  ).toMatchObject({ type: "error", code: "SHIFT_REQUIRED" });
  expect(await register.fixture.localSales()).toHaveLength(0);
});
