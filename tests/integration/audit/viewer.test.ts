// The back office's audit viewer, behind audit.read:
//   GET /audit?actor&role&device&branch&entity&entityId&command&from&to&cursor&limit -> { entries, next }
//   GET /audit/:id -> one entry with before/after/payload and its chain position
//   GET /audit/facets -> the actors, roles, devices, branches, commands and entities seen
//   GET /audit/export.csv?<same filters> -> the filtered entries as CSV
// Entries merge the org chain with every uploaded register chain, newest first, with names resolved.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { asc, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit/sqlite";
import { auditLog, product } from "@shopper/db-pg";
import { tillAudit } from "@shopper/db-sqlite";
import { goldenWorld } from "../../support/sales/golden/setup";
import { runGolden } from "../../support/sales/golden/run";
import { tradingDay } from "../../fixtures/sales/golden/day";
import { ids } from "../../support/till/sales";
import { api as syncApi, deviceId } from "../../support/till/server";
import { syncHeaders } from "../../support/till/requests";
import { memberWithPin } from "../../support/sync/members";
import { get, portalMember, portalOwner, type Portal } from "../../support/api/portal";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let manager: string;
let productId: string;
const managerPin = "2468";

/** A till override as the till records it: the cashier acts, the manager approves with a PIN. */
const tillOverride = defineCommand({
  name: "till.draft.price",
  async run() {},
  audit: () => ({ unitPrice: 9_000, reason: "Damaged pack", pin: managerPin }),
  details: () => ({
    entity: "product",
    entityId: productId,
    before: { unitPrice: 12_000 },
    after: { unitPrice: 9_000, reason: "Damaged pack" },
  }),
});

const query = (params: Record<string, string>, cookie = owner.cookie) =>
  get(owner.api, cookie, `/audit?${new URLSearchParams(params)}`);

beforeAll(async () => {
  world = await goldenWorld();
  await runGolden(world, tradingDay[0]!);
  owner = await portalOwner(ids.org, ids.cashier);
  manager = await memberWithPin("Floor Manager", "admin", managerPin);
  [{ productId }] = (await world.db
    .select({ productId: product.id })
    .from(product)
    .where(eq(product.orgId, ids.org))
    .limit(1)) as [{ productId: string }];
  for (const [amount, reason] of [
    [13_000, "Supplier increase"],
    [14_500, 'Fuel levy, "temporary", review in May'],
  ] as const) {
    const response = await owner.api.request(`/products/${productId}/prices`, {
      method: "POST",
      headers: { cookie: owner.cookie, "content-type": "application/json" },
      body: JSON.stringify({ amount, reason }),
    });
    expect(response.status, await response.clone().text()).toBeLessThan(300);
  }
  await tillOverride(world.local, { ...world.command, approverId: manager }, {});
  const chain = await world.local.read((tx) =>
    tx.select().from(tillAudit).orderBy(asc(tillAudit.chainSeq)),
  );
  const upload = await syncApi.request("/sync/audit", {
    method: "POST",
    headers: syncHeaders(),
    body: JSON.stringify({ requestId: v7(), entries: chain }),
  });
  expect(await upload.json()).toMatchObject({ accepted: {} });
});
afterAll(async () => {
  await world?.local.close();
});

test("a product's history shows its price changes and the till override, who did them and who approved", async () => {
  const { status, body } = await query({ entity: "product", entityId: productId });
  expect(status).toBe(200);
  expect(body.entries.map((e: { command: string }) => e.command)).toEqual([
    "till.draft.price",
    "price.set",
    "price.set",
  ]);
  const [override, second, first] = body.entries;
  expect(override).toMatchObject({
    stream: deviceId,
    device: { id: world.scope.deviceId },
    actor: { id: ids.cashier },
    approver: { id: manager, name: "Floor Manager" },
  });
  expect(second).toMatchObject({ stream: "org", reason: 'Fuel levy, "temporary", review in May' });
  const detail = await get(owner.api, owner.cookie, `/audit/${second.id}`);
  expect(detail.body).toMatchObject({
    id: second.id,
    before: { amount: 13_000 },
    after: { amount: 14_500, productId },
    seq: expect.any(Number),
    hash: expect.stringMatching(/^[0-9a-f]{64}$/),
  });
  expect((await get(owner.api, owner.cookie, `/audit/${first.id}`)).body.after).toMatchObject({
    amount: 13_000,
  });
  const tillDetail = await get(owner.api, owner.cookie, `/audit/${override.id}`);
  expect(tillDetail.body).toMatchObject({
    before: { unitPrice: 12_000 },
    after: { unitPrice: 9_000 },
  });
});

test("each filter narrows the merged log, and cursor pages neither repeat nor skip", async () => {
  const all = await allPages({});
  expect(new Set(all.map((e) => e.stream))).toEqual(new Set(["org", deviceId]));
  expect(all.map((e) => e.id)).toEqual(
    all
      .map((e) => e.id)
      .sort()
      .reverse(),
  );
  expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
  const paged = await allPages({ limit: "3" });
  expect(paged.map((e) => e.id)).toEqual(all.map((e) => e.id));

  const by = async (params: Record<string, string>, keep: (e: Entry) => boolean) => {
    const filtered = await allPages(params);
    expect(filtered.length, JSON.stringify(params)).toBeGreaterThan(0);
    expect(filtered.map((e) => e.id)).toEqual(all.filter(keep).map((e) => e.id));
  };
  await by({ actor: ids.cashier }, (e) => e.actor?.id === ids.cashier);
  await by({ role: "admin" }, (e) => e.role === "admin");
  await by({ command: "sale.complete" }, (e) => e.command === "sale.complete");
  await by({ device: world.scope.deviceId }, (e) => e.device?.id === world.scope.deviceId);
  await by({ branch: world.scope.branchId }, (e) => e.branch?.id === world.scope.branchId);
  await by({ entity: "sale" }, (e) => e.entity === "sale");
  const middle = all[Math.floor(all.length / 2)]!.at;
  await by({ from: middle }, (e) => e.at >= middle);
  await by({ to: middle }, (e) => e.at < middle);

  const facets = await get(owner.api, owner.cookie, "/audit/facets");
  expect(facets.body).toMatchObject({
    commands: expect.arrayContaining(["price.set", "sale.accept", "till.draft.price"]),
    entities: expect.arrayContaining(["product", "sale"]),
    actors: expect.arrayContaining([{ id: manager, name: "Floor Manager" }]),
    devices: expect.arrayContaining([expect.objectContaining({ id: world.scope.deviceId })]),
  });
});

test("the CSV is the filtered log with quoting kept, and no PIN or password reaches any row", async () => {
  const response = await owner.api.request(
    `/audit/export.csv?${new URLSearchParams({ entity: "product", entityId: productId })}`,
    { headers: { cookie: owner.cookie } },
  );
  expect(response.headers.get("content-type")).toMatch(/^text\/csv/);
  const lines = (await response.text()).trim().split("\n");
  expect(lines[0]).toMatch(/^Time,Device time,Stream,Seq,Actor,Role,Device,Branch,Command,/);
  expect(lines).toHaveLength(4);
  expect(lines.join("\n")).toContain('"Fuel levy, ""temporary"", review in May"');
  expect(lines.join("\n")).toContain("Floor Manager");

  const everything = await (
    await owner.api.request("/audit/export.csv", { headers: { cookie: owner.cookie } })
  ).text();
  const rows = await world.db.select().from(auditLog).where(eq(auditLog.orgId, ids.org));
  const local = await world.local.read((tx) => tx.select().from(tillAudit));
  for (const secret of [managerPin, "Shopper-test-password-123"]) {
    expect(everything).not.toContain(secret);
    expect(JSON.stringify(rows)).not.toContain(secret);
    expect(JSON.stringify(local)).not.toContain(secret);
  }
});

test("streams list the org chain and each register with its head, and each verifies on demand", async () => {
  const streams = await get(owner.api, owner.cookie, "/audit/streams");
  expect(streams.body).toEqual([
    expect.objectContaining({
      stream: "org",
      head: expect.objectContaining({ seq: expect.any(Number) }),
    }),
    expect.objectContaining({ stream: deviceId, anchor: null }),
  ]);
  for (const row of streams.body as unknown as { stream: string; count: number; head: object }[])
    expect((await get(owner.api, owner.cookie, `/audit/verify?stream=${row.stream}`)).body).toEqual(
      {
        valid: true,
        count: row.count,
        head: row.head,
      },
    );
  expect((await get(owner.api, owner.cookie, "/audit/verify?stream=nope")).status).toBe(400);
});

test("only audit.read sees the log", async () => {
  const cashier = await portalMember(owner, "cashier");
  for (const path of ["/audit", "/audit/facets", "/audit/export.csv", "/audit/streams"])
    expect((await get(owner.api, cashier, path)).status, path).toBe(403);
  expect((await get(owner.api, null, "/audit")).status).toBe(401);
  const accountant = await portalMember(owner, "accountant");
  expect((await query({}, accountant)).status).toBe(200);
});

type Entry = {
  id: string;
  at: string;
  stream: string;
  command: string;
  entity: string | null;
  role: string | null;
  actor: { id: string } | null;
  device: { id: string } | null;
  branch: { id: string } | null;
};
async function allPages(params: Record<string, string>) {
  const entries: Entry[] = [];
  let cursor: string | null = null;
  do {
    const page: { body: { entries: Entry[]; next: string | null } } = (await query({
      ...params,
      ...(cursor ? { cursor } : {}),
    })) as never;
    entries.push(...page.body.entries);
    cursor = page.body.next;
  } while (cursor);
  return entries;
}
