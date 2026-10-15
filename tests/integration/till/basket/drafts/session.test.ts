// validateSession(db, session, { scope, permission, at }): the session check recordLocalSale performs, extracted.
// `scope` is the configured {orgId, deviceId, branchId}; `at` is device time, corrected by till_state.clockOffsetMs
// (time = at - clockOffsetMs). On success it returns the draft scope {orgId, deviceId, branchId, cashierId: userId}.
import { expect, test } from "vite-plus/test";
import { validateSession } from "@shopper/core/till";
import { tillState } from "@shopper/db-sqlite";
import type { TillDatabase } from "@shopper/db-sqlite";
import {
  at,
  fails,
  ids,
  otherBranch,
  otherDevice,
  scope,
  session,
  withTill,
} from "../../../../support/till/drafts";
import { tableCounts } from "../../../../support/till/basket";

const configured = { orgId: ids.org, deviceId: ids.device, branchId: ids.branch };
const check = (
  db: TillDatabase,
  over: Record<string, unknown> = {},
  time = at,
  permission = "sale.create",
) =>
  validateSession(db, { ...session, ...over } as typeof session, {
    scope: configured,
    permission,
    at: time,
  });
const setOffset = (db: TillDatabase, clockOffsetMs: number) =>
  db.transaction((tx) =>
    tx.insert(tillState).values({
      id: "019a0000-0000-7000-8000-0000000000e2",
      orgId: ids.org,
      deviceId: ids.device,
      clockOffsetMs,
    }),
  );
const issued = new Date(session.issuedAt);
const expires = new Date(session.expiresAt);
const shift = (date: Date, ms: number) => new Date(date.valueOf() + ms);

test("a session in scope, in time and holding the permission yields the draft scope and writes nothing", async () => {
  await withTill(async (db) => {
    const before = await tableCounts(db);
    expect(await check(db)).toEqual(scope);
    expect(await tableCounts(db)).toEqual(before);
  });
});

test.each([
  ["org", { orgId: ids.otherOrg }],
  ["device", { deviceId: otherDevice }],
  ["branch", { branchId: otherBranch }],
])("a session for another %s is rejected with the scope code", async (_name, over) => {
  await withTill(async (db) => {
    await expect(check(db, over)).rejects.toMatchObject(fails("scope"));
  });
});

test("a session without the requested permission is rejected with the permission code", async () => {
  await withTill(async (db) => {
    await expect(check(db, { permissions: [] })).rejects.toMatchObject(fails("permission"));
    await expect(check(db, { permissions: ["sale.void"] })).rejects.toMatchObject(
      fails("permission"),
    );
    expect(await check(db, { permissions: ["sale.void"] }, at, "sale.void")).toEqual(scope);
  });
});

test("an expired or not-yet-valid session is rejected; issuedAt is inclusive and expiresAt exclusive", async () => {
  await withTill(async (db) => {
    expect(await check(db, {}, issued)).toEqual(scope);
    expect(await check(db, {}, shift(expires, -1))).toEqual(scope);
    await expect(check(db, {}, expires)).rejects.toMatchObject(fails("session"));
    await expect(check(db, {}, shift(expires, 60_000))).rejects.toMatchObject(fails("session"));
    await expect(check(db, {}, shift(issued, -1))).rejects.toMatchObject(fails("session"));
    await expect(check(db, {}, new Date(Number.NaN))).rejects.toMatchObject(fails("session"));
  });
});

test("the corrected host time decides validity, not the raw device clock", async () => {
  await withTill(async (db) => {
    await setOffset(db, 60_000); // the device runs a minute ahead of the host
    expect(await check(db, {}, shift(expires, 30_000))).toEqual(scope); // raw: expired, corrected: valid
    await expect(check(db, {}, shift(issued, 30_000))).rejects.toMatchObject(fails("session")); // corrected: before issue
    await expect(check(db, {}, shift(expires, 60_000))).rejects.toMatchObject(fails("session"));
  });
});

test("a device clock behind the host is corrected forward", async () => {
  await withTill(async (db) => {
    await setOffset(db, -120_000);
    await expect(check(db, {}, shift(expires, -60_000))).rejects.toMatchObject(fails("session"));
    expect(await check(db, {}, shift(issued, -60_000))).toEqual(scope);
  });
});

test("a malformed session is rejected", async () => {
  await withTill(async (db) => {
    await expect(check(db, { proof: "" })).rejects.toThrow();
    await expect(check(db, { expiresAt: "tomorrow" })).rejects.toThrow();
  });
});
