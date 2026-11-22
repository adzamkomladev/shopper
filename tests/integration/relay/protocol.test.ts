// v1.5 Day 52: the relay speaks its own publish protocol and the one before, so a box a version behind keeps selling
// online while it waits for its update. The box names its protocol in the signed path; anything else is a 426,
// refused before the request's signature is spent, and the Publisher shows the reason on the settings page.
import { beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { publishPending } from "@shopper/core/relay";
import { ghana2026 } from "@shopper/tax";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { emptyDatabase } from "../../support/migration/archive";
import { db as relayDb } from "../auth/setup";
import { enrol, relayCloud, relayRow, type Box } from "./support";

let relay: Awaited<ReturnType<typeof relayCloud>>;
let shop: Box;

beforeAll(async () => {
  relay = await relayCloud({ relayProtocol: 2 });
  shop = await relay.box();
  await enrol(shop);
});

test("a box on publish/1 reads, publishes and beats against a relay speaking 1 and 2", async () => {
  expect((await relay.send(shop, "/relay/status?protocol=publish/1")).status).toBe(200);
  const published = await relay.send(shop, "/relay/publish?protocol=publish/1", {
    method: "POST",
    body: "{}",
  });
  expect(published.status).toBe(200);
  const beat = await relay.send(shop, "/relay/heartbeat?protocol=publish/2", {
    method: "POST",
    body: "{}",
  });
  expect(beat.status).toBe(200);
  expect((await relayRow(shop))!.lastSeenAt).toBeInstanceOf(Date);
});

test("a box too old or too new is refused 426 with the reason, its signature unspent", async () => {
  const old = await relay.send(shop, "/relay/status?protocol=publish/0");
  expect(old.status).toBe(426);
  expect((await old.json()).error).toMatch(/update this box/i);
  const ahead = await relay.send(shop, "/relay/status?protocol=publish/3");
  expect(ahead.status).toBe(426);
  expect((await ahead.json()).error).toMatch(/relay is older/i);
  expect((await relay.send(shop, "/relay/status?protocol=nonsense")).status).toBe(426);
  // Naming none is publish/1: a relay on 2 still takes it; one on 3 does not.
  expect((await relay.send(shop, "/relay/status")).status).toBe(200);
  // The same cloud (same issuer, same nonces), a version ahead.
  const newer = await relayCloud({ relayProtocol: 3, licenceSigningKey: relay.issuer.privateKey });
  expect((await newer.send(shop, "/relay/status")).status).toBe(426);
  // The refusal spent nothing: the same signed request is taken by a relay that speaks its protocol.
  const signed = await relay.signed(shop, "/relay/status");
  expect((await newer.api.fetch(signed.clone())).status).toBe(426);
  expect((await relay.api.fetch(signed)).status).toBe(200);
});

test("the Publisher names its protocol and keeps a 426 on the settings page", async () => {
  const box = await emptyDatabase();
  const ctx = provisioningContext(shop.licence.org);
  try {
    await provisionOrg(box.db, ctx, { name: "Osu Mart", slug: `p-${Date.now().toString(36)}` });
    await box.db.update(schema.org).set({ onlineOrders: true }).where(eq(schema.org.id, ctx.orgId));
    const paths: string[] = [];
    const ahead = await relayCloud({ relayProtocol: 3 });
    const refused = await publishPending(box.db, ctx, {
      send: (path, init) => (paths.push(path), ahead.send(shop, path, init)),
    });
    expect(refused).toMatchObject({ refused: 426 });
    expect(paths.every((path) => path.endsWith("protocol=publish/1"))).toBe(true);
    const [org] = await box.db
      .select({ relayError: schema.org.relayError })
      .from(schema.org)
      .where(eq(schema.org.id, ctx.orgId));
    expect(org?.relayError).toMatch(/update this box/i);
    // Against a relay that speaks it, the whole run goes through and clears the reason.
    paths.length = 0;
    expect(
      await publishPending(box.db, ctx, {
        send: (path, init) => (paths.push(path), relay.send(shop, path, init)),
      }),
    ).not.toHaveProperty("refused");
    expect(paths).toContain("/relay/heartbeat?protocol=publish/1");
    const [after] = await box.db
      .select({ relayError: schema.org.relayError })
      .from(schema.org)
      .where(eq(schema.org.id, ctx.orgId));
    expect(after?.relayError).toBeNull();
  } finally {
    await box.close();
  }
});

test("a pre-Day 52 shop row (no tax rules) still publishes; a moved rule date applies in one go", async () => {
  const orgId = provisioningContext(shop.licence.org).orgId;
  const shopRow = { id: orgId, tin: null, vatRegisteredFrom: null, priceMode: "inclusive" };
  const publish = (row: object) =>
    relay.send(shop, "/relay/publish?protocol=publish/1", {
      method: "POST",
      body: JSON.stringify({ shop: [row] }),
    });
  const rule = (id: string, effectiveFrom: string) => ({ id, ...ghana2026, effectiveFrom });
  const [future, replacement] = [v7(), v7()];
  expect((await publish({ ...shopRow, taxRules: [rule(future, "2031-01-01")] })).status).toBe(200);
  expect((await publish(shopRow)).status).toBe(200);
  const rules = () =>
    relayDb
      .select({ id: schema.taxRule.id, effectiveFrom: schema.taxRule.effectiveFrom })
      .from(schema.taxRule)
      .where(eq(schema.taxRule.orgId, orgId))
      .orderBy(schema.taxRule.effectiveFrom);
  expect(await rules()).toEqual([{ id: future, effectiveFrom: "2031-01-01" }]);
  // The box moved its future rule a year on and put a new one on the old date.
  const moved = [rule(replacement, "2031-01-01"), rule(future, "2032-01-01")];
  expect((await publish({ ...shopRow, taxRules: moved })).status).toBe(200);
  expect(await rules()).toEqual([
    { id: replacement, effectiveFrom: "2031-01-01" },
    { id: future, effectiveFrom: "2032-01-01" },
  ]);
});
