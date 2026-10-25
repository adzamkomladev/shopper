import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { zReport } from "@shopper/core/schemas";
import * as v from "valibot";
import { goldenWorld } from "../../support/sales/golden/setup";
import { edit, postShift, shiftEvent } from "../../support/sales/shifts";
import { ids } from "../../support/till/sales";
import { memberWithPin } from "../../support/sync/members";
import { boxCache } from "@shopper/adapters-box";
import { serveRuntime } from "@shopper/api/runtime";
import { databases } from "../../support/till/server";
import {
  baseURL,
  get,
  portalMember,
  portalOwner,
  secret,
  type Portal,
} from "../../support/api/portal";

// Three closed shifts on the golden till, uploaded as the till would, 20:00 / 21:00 / 19:00:
//   balanced; cash GHS 6 short with a manager's approval; cash -3 000 and card +10 000 (short -3 000, over 10 000)
let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let manager: string;
let stranger: string;
const events: Record<
  "balanced" | "short" | "mixed" | "ghost",
  ReturnType<typeof shiftEvent>
> = {} as never;
const cashier = ids.cashier;
const idOf = (name: keyof typeof events) => events[name].shift.report.shiftId;

beforeAll(async () => {
  world = await goldenWorld();
  manager = await memberWithPin("Shift Manager", "admin", "2468");
  stranger = v7();
  events.balanced = shiftEvent(world);
  events.short = shiftEvent(world, {
    closedAt: "2026-10-15T21:00:00.000Z",
    cash: 976_000,
    approverId: manager,
  });
  events.mixed = shiftEvent(world, {
    closedAt: "2026-10-15T19:00:00.000Z",
    cash: 1_033_000,
    card: 22_000,
  });
  // A name on the Z that belongs to nobody in this org must not appear in `names`.
  events.ghost = edit(shiftEvent(world, { closedAt: "2026-10-15T18:00:00.000Z" }), (z) => {
    z.cashiers.push({ userId: stranger, name: "Ghost" });
  });
  for (const event of Object.values(events))
    expect((await postShift(event, world.session.proof)).body.accepted).toBeDefined();
  owner = await portalOwner(ids.org, cashier);
});
afterAll(async () => {
  await world?.local.close();
});

const row = (name: keyof typeof events, over: object) => ({
  id: idOf(name),
  deviceId: world.scope.deviceId,
  deviceName: "Sync till",
  branchId: world.scope.branchId,
  branchName: "Main",
  openedAt: "2026-10-15T08:00:00.000Z",
  closedAt: events[name].shift.report.closedAt,
  closedBy: cashier,
  closedByName: "Cashier",
  approverId: null,
  approverName: null,
  expectedCash: 1_036_000,
  declaredCash: 1_036_000,
  short: 0,
  over: 0,
  // These Zs are worked by hand: the server holds none of their sales or refunds, nor the chain they anchor.
  checks: {
    totals: {
      status: "mismatch",
      fields: [
        "sales.count",
        "sales.gross",
        "sales.tax",
        "refunds.count",
        "refunds.total",
        "cash.sales",
        "cash.refunds",
        "card.sales",
        "card.refunds",
      ],
    },
    anchor: "pending",
  },
  ...over,
});
const rowsOf = () => ({
  short: row("short", {
    approverId: manager,
    approverName: "Shift Manager",
    declaredCash: 976_000,
    short: -60_000,
  }),
  balanced: row("balanced", {}),
  mixed: row("mixed", { declaredCash: 1_033_000, short: -3_000, over: 10_000 }),
  ghost: row("ghost", {}),
});

test("the owner lists uploaded shifts newest closed first with names, amounts, and shortage and overage kept apart", async () => {
  const rows = rowsOf();
  const { status, body } = await get(owner.api, owner.cookie, "/shifts");
  expect(status).toBe(200);
  expect(body).toEqual({ shifts: [rows.short, rows.balanced, rows.mixed, rows.ghost] });
});

test("a shift's detail is the stored Z exactly, with the names of the members it mentions", async () => {
  const { status, body } = await get(owner.api, owner.cookie, `/shifts/${idOf("short")}`);
  expect(status).toBe(200);
  expect(body).toEqual({
    ...rowsOf().short,
    // The fixture Z predates the account lines, so it reads with them all at zero.
    report: {
      ...events.short.shift.report,
      account: { sales: 0, payments: { cash: 0, momo: 0 }, refunds: 0, points: 0, pointsValue: 0 },
    },
    names: { [cashier]: "Cashier", [manager]: "Shift Manager" },
  });
  expect(v.safeParse(zReport, body.report).success).toBe(true);
});

test("a name on the Z that is not a member of the org is left out of the names", async () => {
  const { body } = await get(owner.api, owner.cookie, `/shifts/${idOf("ghost")}`);
  expect(body.report.cashiers).toContainEqual({ userId: stranger, name: "Ghost" });
  expect(body.names).toEqual({ [cashier]: "Cashier" });
});

test("shift.read is data: an accountant reads shifts and an inventory clerk gets 403 on both routes", async () => {
  const accountant = await portalMember(owner, "accountant");
  expect((await get(owner.api, accountant, "/shifts")).body.shifts).toHaveLength(4);
  expect((await get(owner.api, accountant, `/shifts/${idOf("balanced")}`)).status).toBe(200);

  const clerk = await portalMember(owner, "inventory");
  for (const path of ["/shifts", `/shifts/${idOf("balanced")}`]) {
    const denied = await get(owner.api, clerk, path);
    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({ error: "Permission denied" });
  }
});

test("both routes are 401 without a session", async () => {
  for (const path of ["/shifts", `/shifts/${idOf("balanced")}`]) {
    const anonymous = await get(owner.api, null, path);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ error: "Authentication required" });
  }
});

test("another org's owner sees none of these shifts and gets 404 for their ids", async () => {
  const foreign = await portalOwner(ids.otherOrg);
  expect(await get(foreign.api, foreign.cookie, "/shifts")).toEqual({
    status: 200,
    body: { shifts: [] },
  });
  const crossed = await get(foreign.api, foreign.cookie, `/shifts/${idOf("balanced")}`);
  expect(crossed).toEqual({ status: 404, body: { error: expect.any(String) } });
});

test("an unknown shift id is 404 and an id that is not a UUID is 400", async () => {
  const unknown = await get(owner.api, owner.cookie, `/shifts/${v7()}`);
  expect(unknown).toEqual({ status: 404, body: { error: expect.any(String) } });
  for (const bad of ["nope", "123", `${idOf("balanced")}x`]) {
    const response = await get(owner.api, owner.cookie, `/shifts/${bad}`);
    expect(response).toEqual({ status: 400, body: { error: expect.any(String) } });
  }
});

test("the shared runtime (Worker and box) serves /shifts behind the session, not the public API", async () => {
  const cache = boxCache(":memory:");
  try {
    const options = {
      database: databases().db,
      cache: cache.cache,
      secret,
      baseURL,
      orgId: ids.org,
    };
    const send = (headers: Record<string, string>) =>
      serveRuntime(new Request(`${baseURL}/shifts`, { headers }), options);
    expect((await send({})).status).toBe(401);
    const signedIn = await send({ cookie: owner.cookie });
    expect(signedIn.status).toBe(200);
    expect((await signedIn.json()).shifts).toHaveLength(4);
  } finally {
    cache.close();
  }
});
