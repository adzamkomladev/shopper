// Tiers: a name, the spend over the trailing 365 days that earns it (money) and an earn rate in bps. The tier is worked
// out at earn time from the customer's spend before the sale and is never stored; each earn entry keeps the rate it used.
// CRUD is /loyalty/tiers (GET needs customer.read, the rest customer.manage); archiving takes a tier out of play.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { portalMember, portalOwner, type Portal } from "../../../support/api/portal";
import { addCustomer } from "../../../support/customers/seed";
import { freshSale, pushSale, sameTillSale } from "../../../support/customers/credit";
import { auditCommands, chainValid } from "../../../support/customers/ledger";
import { ON, cashSaleEvent, loyaltyApi, pointEntries } from "../../../support/customers/loyalty";
import { ids } from "../../../support/till/sales";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let admin: ReturnType<typeof loyaltyApi>;
let cashier: ReturnType<typeof loyaltyApi>;
beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  admin = loyaltyApi(owner, owner.cookie);
  cashier = loyaltyApi(owner, await portalMember(owner, "cashier"));
  expect((await admin.setSettings(ON)).status).toBe(200);
});
afterAll(async () => world?.local.close());

test("a tier is created, listed, edited and archived, with validation, audit and roles", async () => {
  const made = await admin.createTier({ name: "Silver", minSpend: 2_400_000, earnBps: 150 });
  expect(made).toMatchObject({
    status: 201,
    body: { name: "Silver", minSpend: 2_400_000, earnBps: 150, archivedAt: null },
  });
  const id = made.body.id as string;
  expect((await admin.tiers()).body.items).toMatchObject([{ id, name: "Silver" }]);

  expect((await admin.patchTier(id, { name: "Silver+", earnBps: 175 })).body).toMatchObject({
    id,
    name: "Silver+",
    minSpend: 2_400_000,
    earnBps: 175,
  });
  for (const bad of [
    { name: "", minSpend: 0, earnBps: 100 },
    { name: "X", minSpend: -1, earnBps: 100 },
    { name: "X", minSpend: 1.5, earnBps: 100 },
    { name: "X", minSpend: 0, earnBps: 0 },
    { name: "X", minSpend: 0, earnBps: 10_001 },
    { name: "X", minSpend: 0 },
    { name: "X", minSpend: 0, earnBps: 100, extra: true },
  ])
    expect((await admin.createTier(bad)).status).toBe(400);
  expect((await admin.patchTier(id, { earnBps: 0 })).status).toBe(400);
  expect((await admin.patchTier(v7(), { name: "Ghost" })).status).toBe(404);

  // Reading is open to anyone who may read customers; writing is not.
  expect((await cashier.tiers()).status).toBe(200);
  expect((await cashier.createTier({ name: "Gold", minSpend: 1, earnBps: 100 })).status).toBe(403);
  expect((await cashier.patchTier(id, { name: "Hacked" })).status).toBe(403);
  expect((await cashier.archiveTier(id)).status).toBe(403);

  const archived = await admin.archiveTier(id);
  expect(archived.body.archivedAt).not.toBeNull();
  expect((await admin.tiers()).body.items).toEqual([]);
  expect((await admin.archiveTier(id)).status).toBe(200);
  expect(await chainValid()).toBe(true);
});

test("spend crosses a tier, so the next earn uses the tier's rate and the entry keeps it", async () => {
  const tier = await admin.createTier({ name: "Gold", minSpend: 240_000, earnBps: 200 });
  expect(tier.status).toBe(201);
  const customerId = await addCustomer({ phone: "0271792001" });
  // Each sale is GH₵12.00 (120 000 units). Spend before the third is GH₵24.00, which is the tier's minimum.
  const first = await freshSale();
  const second = await sameTillSale();
  const third = await sameTillSale();
  const fourth = await sameTillSale();
  for (const created of [first, second, third, fourth])
    expect(
      (await pushSale(created, cashSaleEvent(created, customerId))).body.accepted,
    ).toHaveLength(1);
  const earns = await pointEntries(customerId);
  expect(earns.map((e) => [e.points, e.rate_bps])).toEqual([
    [12, 100],
    [12, 100],
    [24, 200],
    [24, 200],
  ]);
  expect(earns.every((e) => e.point_value === 100)).toBe(true);
  expect((await admin.history(customerId)).body.tier).toMatchObject({ name: "Gold", earnBps: 200 });
  expect(await auditCommands(customerId)).toContain("sale.accept");
});

test("an archived tier no longer applies, and a customer under every tier earns the org rate", async () => {
  const tiers = (await admin.tiers()).body.items as { id: string; name: string }[];
  const gold = tiers.find((t) => t.name === "Gold")!;
  expect((await admin.archiveTier(gold.id)).status).toBe(200);
  const customerId = await addCustomer({ phone: "0271792002" });
  const created = await sameTillSale();
  expect((await pushSale(created, cashSaleEvent(created, customerId))).body.accepted).toHaveLength(
    1,
  );
  expect(await pointEntries(customerId)).toMatchObject([{ points: 12, rate_bps: 100 }]);
  expect((await admin.history(customerId)).body.tier).toBeNull();
});
