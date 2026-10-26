// A member limited to branches sees and writes only those branches in the portal API; org-wide members see all.
// The golden world's records all sit in its main branch; `other` is a second branch of the same store.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq, inArray } from "drizzle-orm";
import { v7 } from "uuid";
import { permission, rolePermission } from "@shopper/db-pg";
import { databases } from "../../../support/till/server";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { postShift, shiftEvent } from "../../../support/sales/shifts";
import { products } from "../../../fixtures/sales/golden/references";
import { ids } from "../../../fixtures/sales/golden";
import { addBranch, addDocument, addMovements, addSupplier } from "../../../support/stock/seed";
import { get, portalMember, portalOwner, type Portal } from "../../../support/api/portal";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let other: string;
let document: string;
let shiftId: string;
/** A "lead" (every branch-keyed read and write) limited to `other`, and one limited to the golden branch. */
let elsewhere: string;
let local: string;
const main = ids.branch;

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  other = await addBranch(ids.store);
  await addMovements([{ productId: products.standard.id, quantity: 4_000, at: "08:00" }]);
  document = await addDocument({
    kind: "receipt",
    supplierId: await addSupplier("Scope Supplies"),
    at: "09:00",
    lines: [{ productId: products.standard.id, quantity: 1_000, unitCost: 100_000 }],
  });
  const event = shiftEvent(world);
  shiftId = event.shift.report.shiftId;
  expect((await postShift(event, world.session.proof)).body.accepted).toBeDefined();
  const lead = await send(owner.cookie, "/roles", "POST", {
    name: "lead",
    permissionCodes: [
      "shift.read",
      "stock.read",
      "stock.write",
      "device.read",
      "device.enroll",
      "device.revoke",
      "audit.read",
      "tax.read",
    ],
  });
  expect(lead.status).toBe(201);
  elsewhere = await scoped([other]);
  local = await scoped([main]);
  // The branch and store lists are owner-only by seed; the portal's admin can't grant them, so seed them in once
  // both members are set up.
  const { db } = databases();
  const roleId = ((await lead.json()) as { id: string }).id;
  const reads = await db
    .select({ id: permission.id })
    .from(permission)
    .where(
      and(eq(permission.orgId, ids.org), inArray(permission.code, ["branch.read", "store.read"])),
    );
  await db
    .insert(rolePermission)
    .values(reads.map((row) => ({ orgId: ids.org, roleId, permissionId: row.id })));
});
afterAll(async () => {
  await world?.local.close();
});

async function scoped(branchIds: string[]) {
  const cookie = await portalMember(owner, "lead");
  const principal = await owner.auth.resolvePrincipal(
    new Request("http://localhost", { headers: { cookie } }),
  );
  const response = await owner.api.request(`/users/${principal!.userId}/branches`, {
    method: "PUT",
    headers: { cookie: owner.cookie, "content-type": "application/json" },
    body: JSON.stringify({ branchIds }),
  });
  expect(response.status).toBe(200);
  return cookie;
}

const send = (cookie: string, path: string, method: string, body: unknown) =>
  owner.api.request(path, {
    method,
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const ofMain = (rows: { branchId?: string | null }[]) =>
  rows.filter((row) => row.branchId === main);

test("shifts, stock records and registers of another branch are invisible", async () => {
  expect((await get(owner.api, elsewhere, "/shifts")).body.shifts).toEqual([]);
  expect((await get(owner.api, elsewhere, `/shifts/${shiftId}`)).status).toBe(404);
  expect((await get(owner.api, local, "/shifts")).body.shifts).toHaveLength(1);
  expect((await get(owner.api, owner.cookie, "/shifts")).body.shifts).toHaveLength(1);

  expect((await get(owner.api, elsewhere, `/stock?branchId=${main}`)).status).toBe(403);
  expect((await get(owner.api, elsewhere, `/stock?branchId=${other}`)).status).toBe(200);
  expect((await get(owner.api, elsewhere, `/stock/documents/${document}`)).status).toBe(404);
  expect((await get(owner.api, local, `/stock/documents/${document}`)).status).toBe(200);
  expect(ofMain((await get(owner.api, elsewhere, "/stock/documents")).body.items)).toEqual([]);
  expect(ofMain((await get(owner.api, local, "/stock/documents")).body.items)).not.toEqual([]);
  expect((await get(owner.api, elsewhere, "/stock/branches")).body.branches).toEqual([
    expect.objectContaining({ id: other }),
  ]);
  expect((await get(owner.api, elsewhere, "/stock/takes")).body.items).toEqual([]);

  const devices = (await get(owner.api, elsewhere, "/devices")).body as unknown as {
    branchId: string;
  }[];
  expect(devices.map((row) => row.branchId)).not.toContain(main);
  const all = (await get(owner.api, owner.cookie, "/devices")).body as unknown as {
    branchId: string;
  }[];
  expect(all.map((row) => row.branchId)).toContain(main);
});

test("writes naming another branch are refused before anything is recorded", async () => {
  const adjustment = {
    id: v7(),
    branchId: main,
    cause: "found",
    lines: [{ productId: products.standard.id, quantityThousandths: 1_000 }],
  };
  expect((await send(elsewhere, "/stock/adjustments", "POST", adjustment)).status).toBe(403);
  const own = { ...adjustment, id: v7(), branchId: other };
  expect((await send(elsewhere, "/stock/adjustments", "POST", own)).status).toBe(201);
  const take = { id: v7(), branchId: main, scope: "full" };
  expect((await send(elsewhere, "/stock/takes", "POST", take)).status).toBe(403);
  const enrollment = await send(elsewhere, "/devices/enrollment", "POST", { branchId: main });
  expect(enrollment.status).toBe(403);
  expect((await send(local, "/devices/enrollment", "POST", { branchId: main })).status).toBe(201);
  // However the id is spelled, a register at another branch stays enrolled.
  const register = { deviceId: world.scope.deviceId.toUpperCase() };
  expect((await send(elsewhere, "/devices/revoke", "POST", register)).status).toBe(403);
  const all = (await get(owner.api, owner.cookie, "/devices")).body as unknown as {
    id: string;
    status: string;
  }[];
  expect(all.find((row) => row.id === world.scope.deviceId)?.status).toBe("active");
});

test("the audit log, tax and fiscal views and the branch lists keep to the member's branches", async () => {
  const entries = (await get(owner.api, elsewhere, "/audit?limit=200")).body.entries as {
    branch: { id: string } | null;
  }[];
  expect(entries.filter((row) => row.branch?.id === main)).toEqual([]);
  // Their own adjustment at `other` (the writes test) is recorded against that branch, so they see it.
  expect(entries.some((row) => row.branch?.id === other)).toBe(true);
  const mine = (await get(owner.api, local, "/audit?limit=200")).body.entries as typeof entries;
  expect(mine.some((row) => row.branch?.id === main)).toBe(true);
  expect(mine.every((row) => row.branch?.id === main)).toBe(true);
  const csv = await owner.api.request("/audit/export.csv", { headers: { cookie: elsewhere } });
  expect(await csv.text()).not.toContain("Main");
  // Chain verification and the org stream span every branch: org-wide members only.
  expect((await get(owner.api, elsewhere, "/audit/streams")).status).toBe(403);

  // The golden world uploads no sales, so the summary is checked for its refusal and its scope only.
  const range = "from=2026-10-01&to=2026-10-31";
  expect((await get(owner.api, elsewhere, `/tax/summary?${range}`)).status).toBe(200);
  expect((await get(owner.api, elsewhere, `/tax/summary?${range}&branchId=${main}`)).status).toBe(
    403,
  );
  expect((await get(owner.api, local, `/tax/summary?${range}&branchId=${main}`)).status).toBe(200);
  // A VAT return covers the whole organisation.
  expect((await get(owner.api, elsewhere, "/tax/returns/2026-10")).status).toBe(403);
  const fiscal = await get(owner.api, elsewhere, "/tax/fiscal");
  expect(fiscal.status).toBe(200);
  expect(JSON.stringify(fiscal.body.documents)).not.toContain(main);

  const listed = await get(owner.api, elsewhere, "/branches");
  expect(listed.status, JSON.stringify(listed.body)).toBe(200);
  const branches = listed.body as unknown as {
    id: string;
  }[];
  expect(branches.map((row) => row.id)).toEqual([other]);
  expect((await get(owner.api, elsewhere, `/branches/${main}`)).status).toBe(404);
  const theirs = (await get(owner.api, local, "/branches")).body as unknown as { id: string }[];
  expect(theirs.map((row) => row.id)).toEqual([main]);
  const stores = (await get(owner.api, elsewhere, "/stores")).body as unknown as { id: string }[];
  expect(stores.map((row) => row.id)).toEqual([ids.store]);
});
