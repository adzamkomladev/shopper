// shift.open over the bridge: { id, type: "shift.open", float } or { counts } (exactly one) answers the status; after the
// commit the host publishes it and kicks the drawer. A drawer or printer fault never undoes the open.
import { afterEach, expect, test } from "vite-plus/test";
import * as v from "valibot";
import { bridgeMessage } from "@shopper/sync/bridge";
import { denominate, startShifter, type Shifter } from "../../../../../support/till/host/shifts";

let shifter: Shifter | undefined;
afterEach(async () => {
  await shifter?.close();
  shifter = undefined;
});

test("opening a shift with a float commits it, answers the status and kicks the drawer once", async () => {
  shifter = await startShifter({ shift: false });
  const { register, printer } = shifter;
  expect((await register.status()).shift).toMatchObject({ current: null, last: null });
  const opened = await register.ask({ type: "shift.open", float: 1_000_000 });
  expect(opened).toMatchObject({
    type: "result",
    kind: "status",
    status: {
      shift: {
        current: {
          status: "open",
          float: 1_000_000,
          openedBy: register.fixture.config.session!.userId,
        },
        last: null,
      },
    },
  });
  expect(v.safeParse(bridgeMessage, opened).success).toBe(true);
  expect((await register.status()).shift.current.id).toBe(opened.status.shift.current.id);
  const [job, ...rest] = await printer.waitForJobs(1);
  expect(rest).toHaveLength(0);
  expect(job?.kicks).toBe(1);
  expect(await register.audit("shift.open")).toHaveLength(1);
});

test("a float counted by denomination is the sum of the notes and coins", async () => {
  shifter = await startShifter({ shift: false });
  const opened = await shifter.register.ask({
    type: "shift.open",
    counts: denominate(1_234_500),
  });
  expect(opened).toMatchObject({
    type: "result",
    kind: "status",
    status: { shift: { current: { status: "open", float: 1_234_500 } } },
  });
});

test("opening a second shift on a register that has one is SHIFT_OPEN and nothing happens at the drawer", async () => {
  shifter = await startShifter();
  const { register } = shifter;
  const before = (await register.status()).shift.current;
  expect(await register.ask({ type: "shift.open", float: 500_000 })).toMatchObject({
    type: "error",
    code: "SHIFT_OPEN",
  });
  expect((await register.status()).shift.current).toEqual(before);
  expect(await shifter.jobs()).toHaveLength(0);
  expect(await register.audit("shift.open")).toHaveLength(0);
});

test.each([
  ["neither a float nor a count", {}],
  ["both a float and a count", { float: 1_000_000, counts: denominate(1_000_000) }],
  ["a negative float", { float: -100 }],
  ["a fractional float", { float: 100.5 }],
])("%s is refused before anything is written", async (_name, body) => {
  shifter = await startShifter({ shift: false });
  const { register } = shifter;
  expect(await register.ask({ type: "shift.open", ...body })).toMatchObject({
    type: "error",
    code: expect.stringMatching(/^INVALID_(MESSAGE|INPUT)$/),
  });
  expect((await register.status()).shift.current).toBeNull();
  expect(await shifter.jobs()).toHaveLength(0);
});

test("a printer that is down does not undo the open: the reply is still the status", async () => {
  shifter = await startShifter({ shift: false, printer: "down" });
  const { register } = shifter;
  const opened = await register.ask({ type: "shift.open", float: 1_000_000 });
  expect(opened).toMatchObject({
    type: "result",
    kind: "status",
    status: { shift: { current: { status: "open", float: 1_000_000 } } },
  });
  expect(await register.audit("shift.open")).toHaveLength(1);
});

test("a register with no printer opens the shift all the same", async () => {
  shifter = await startShifter({ shift: false, printer: "none" });
  expect(await shifter.register.ask({ type: "shift.open", float: 1_000_000 })).toMatchObject({
    type: "result",
    kind: "status",
    status: { shift: { current: { status: "open" } } },
  });
});
