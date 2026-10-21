// shift.drop, shift.nosale and shift.report over the bridge. Drops and no-sales commit, answer the status and kick the
// drawer; the X (report.read) shows them. The status never carries what the drawer should hold (blind count).
import { afterEach, expect, test } from "vite-plus/test";
import * as v from "valibot";
import { bridgeMessage } from "@shopper/sync/bridge";
import { startShifter, type Shifter } from "../../../../../support/till/host/shifts";

let shifter: Shifter | undefined;
afterEach(async () => {
  await shifter?.close();
  shifter = undefined;
});

test("a cash drop lowers the expected cash in the X, is audited and kicks the drawer", async () => {
  shifter = await startShifter();
  const { register, printer } = shifter;
  const dropped = await register.ask({ type: "shift.drop", amount: 500_000, reason: "Safe run" });
  expect(dropped).toMatchObject({ type: "result", kind: "status" });
  expect(v.safeParse(bridgeMessage, dropped).success).toBe(true);
  const [job, ...rest] = await printer.waitForJobs(1);
  expect(rest).toHaveLength(0);
  expect(job?.kicks).toBe(1);

  const x = await register.ask({ type: "shift.report" });
  expect(x).toMatchObject({
    type: "result",
    kind: "shiftReport",
    report: {
      kind: "x",
      cash: { float: 2_000_000, drops: 500_000, expected: 1_500_000 },
      movements: [{ kind: "drop", amount: 500_000, reason: "Safe run" }],
    },
  });
  expect(v.safeParse(bridgeMessage, x).success).toBe(true);
  expect(await register.audit("shift.drop")).toHaveLength(1);
});

test("a drop without a reason is allowed and a no-sale without one is refused", async () => {
  shifter = await startShifter();
  const { register } = shifter;
  expect(await register.ask({ type: "shift.drop", amount: 100_000 })).toMatchObject({
    type: "result",
    kind: "status",
  });
  expect(await register.ask({ type: "shift.nosale" })).toMatchObject({
    type: "error",
    code: "INVALID_MESSAGE",
  });
  expect(await register.audit("shift.nosale")).toHaveLength(0);
});

test("a no-sale kicks the drawer, shows in the X and leaves the expected cash alone", async () => {
  shifter = await startShifter();
  const { register, printer } = shifter;
  expect(
    await register.ask({ type: "shift.nosale", reason: "Change for a customer" }),
  ).toMatchObject({ type: "result", kind: "status" });
  const [job] = await printer.waitForJobs(1);
  expect(job?.kicks).toBe(1);
  expect(await register.ask({ type: "shift.report" })).toMatchObject({
    report: {
      cash: { drops: 0, expected: 2_000_000 },
      movements: [{ kind: "no_sale", amount: 0, reason: "Change for a customer" }],
    },
  });
  expect(await register.audit("shift.nosale")).toHaveLength(1);
});

test.each([
  ["a drop", { type: "shift.drop", amount: 100_000, reason: "Safe run" }],
  ["a no-sale", { type: "shift.nosale", reason: "Change" }],
])(
  "%s on a register with no shift is SHIFT_REQUIRED and the drawer stays shut",
  async (_n, body) => {
    shifter = await startShifter({ shift: false });
    expect(await shifter.register.ask(body)).toMatchObject({
      type: "error",
      code: "SHIFT_REQUIRED",
    });
    expect(await shifter.jobs()).toHaveLength(0);
  },
);

test("a drop with a printer that is down still commits and answers the status", async () => {
  shifter = await startShifter({ printer: "down" });
  const { register } = shifter;
  expect(
    await register.ask({ type: "shift.drop", amount: 300_000, reason: "Safe run" }),
  ).toMatchObject({ type: "result", kind: "status" });
  expect(await register.audit("shift.drop")).toHaveLength(1);
});

test("the X needs report.read: a cashier without it gets a permission error", async () => {
  shifter = await startShifter({ permissions: ["register.settings"] });
  expect(await shifter.register.ask({ type: "shift.report" })).toMatchObject({
    type: "error",
    code: "permission",
  });
});

test("the X of a register with no shift is SHIFT_REQUIRED", async () => {
  shifter = await startShifter({ shift: false });
  expect(await shifter.register.ask({ type: "shift.report" })).toMatchObject({
    type: "error",
    code: "SHIFT_REQUIRED",
  });
});

test("the status carries the shift but never what the drawer should hold", async () => {
  shifter = await startShifter();
  const { register } = shifter;
  await register.ask({ type: "shift.drop", amount: 500_000, reason: "Safe run" });
  const { shift } = await register.status();
  expect(shift).toMatchObject({
    current: { status: "open", float: 2_000_000 },
    last: null,
  });
  const text = JSON.stringify(shift);
  expect(text).not.toContain("expected");
  expect(text).not.toContain("1500000");
  expect(Object.keys(shift.current).sort()).toEqual(
    ["float", "id", "openedAt", "openedBy", "status"].sort(),
  );
});
