// v1.5 Day 46: a box authenticates to its relay org by licence-signed requests, and nothing else gets in. Unsigned,
// forged, stale, tampered or replayed requests are refused, and so are revoked licences, boxes without the Online
// Orders add-on and boxes whose maintenance has lapsed.
import { beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { generateKey, signedRequest } from "@shopper/core/licence";
import { revokeRelay } from "@shopper/core/relay";
import { context, db, otherContext } from "../auth/setup";
import { CLOUD, enrol, relayCloud, relayRow, type Box } from "./support";

let cloud: Awaited<ReturnType<typeof relayCloud>>;
let shop: Box;

beforeAll(async () => {
  cloud = await relayCloud();
  shop = await cloud.box();
  await enrol(shop);
});

test("an enrolled box reads its relay status, beats its heartbeat and reads its order inbox", async () => {
  const status = await cloud.send(shop, "/relay/status");
  expect(status.status).toBe(200);
  expect(await status.json()).toMatchObject({
    orgId: shop.licence.org,
    licenceId: shop.licence.id,
    onlineOrders: true,
    maintenanceUntil: "2099-12-31",
  });
  const [org] = await db.select().from(schema.org).where(eq(schema.org.id, shop.licence.org));
  expect(org).toMatchObject({ mode: "relay", name: "Osu Mart" });

  expect((await relayRow(shop))!.lastSeenAt).toBeNull();
  const beat = await cloud.send(shop, "/relay/heartbeat", { method: "POST", body: "{}" });
  expect(beat.status).toBe(200);
  expect((await relayRow(shop))!.lastSeenAt).toBeInstanceOf(Date);

  // Each store numbers its own orders, so the box reads its inbox store by store.
  const inbox = await cloud.send(shop, `/relay/orders?store=${shop.licence.id}&after=0`);
  expect(inbox.status).toBe(200);
  expect(await inbox.json()).toEqual({ orders: [], cursor: "0" });
  expect((await cloud.send(shop, "/relay/orders?after=0")).status).toBe(400);
});

test("unsigned, forged, stale and tampered requests are refused", async () => {
  expect((await cloud.api.request("/relay/status")).status).toBe(401);
  // A licence Shopper never signed, even for an enrolled org and licence id.
  const stranger = await generateKey();
  const forged = await cloud.box(
    { id: shop.licence.id, org: shop.licence.org },
    stranger.privateKey,
  );
  expect((await cloud.send(forged, "/relay/status")).status).toBe(401);
  // Signed six minutes ago: past the five-minute window.
  const stale = await cloud.send(
    shop,
    "/relay/status",
    { method: "GET" },
    new Date(Date.now() - 360_000),
  );
  expect(stale.status).toBe(401);
  // Signed over one body, sent with another.
  const signed = await signedRequest(shop, `${CLOUD}/relay/heartbeat`, {
    method: "POST",
    body: "{}",
  });
  const tampered = new Request(signed, { method: "POST", body: '{"orgId":"x"}' });
  expect((await cloud.api.fetch(tampered)).status).toBe(401);
});

test("a signed request is used once: the replay is refused", async () => {
  const request = await signedRequest(shop, `${CLOUD}/relay/heartbeat`, {
    method: "POST",
    body: "{}",
  });
  expect((await cloud.api.fetch(request.clone())).status).toBe(200);
  const replay = await cloud.api.fetch(request.clone());
  expect(replay.status).toBe(401);
  expect((await replay.json()).error).toMatch(/already/i);
  // The same signature spelled differently (padding, whitespace) decodes to the same bytes: still a replay.
  const signature = request.headers.get("shopper-signature")!;
  for (const respelled of [`${signature}==`, `${signature.slice(0, 10)}\t${signature.slice(10)}`]) {
    const headers = new Headers(request.headers);
    headers.set("shopper-signature", respelled);
    const again = await cloud.api.fetch(new Request(request.clone(), { headers }));
    expect(again.status, JSON.stringify(respelled)).toBe(401);
  }
});

test("revoked, unenrolled and add-on-less boxes are refused 403; lapsed maintenance 402", async () => {
  const stranger = await cloud.box();
  expect((await cloud.send(stranger, "/relay/status")).status).toBe(403);

  const withoutAddOn = await cloud.box();
  await enrol(withoutAddOn, false);
  const refused = await cloud.send(withoutAddOn, "/relay/status");
  expect(refused.status).toBe(403);
  expect((await refused.json()).error).toMatch(/online orders/i);

  const lapsed = await cloud.box({ maintenanceUntil: "2026-01-01" });
  await enrol(lapsed);
  const unpaid = await cloud.send(lapsed, "/relay/status");
  expect(unpaid.status).toBe(402);
  expect((await unpaid.json()).error).toMatch(/support/i);

  const stolen = await cloud.box();
  await enrol(stolen);
  expect((await cloud.send(stolen, "/relay/status")).status).toBe(200);
  await revokeRelay(
    db,
    { orgId: otherContext.orgId, appVersion: context.appVersion },
    {
      licenceId: stolen.licence.id,
    },
  );
  const revoked = await cloud.send(stolen, "/relay/heartbeat", { method: "POST", body: "{}" });
  expect(revoked.status).toBe(403);
  expect((await revoked.json()).error).toMatch(/revoked/i);
});

test("a box acts on its own relay org only, whatever the request names", async () => {
  const other = await cloud.box();
  await enrol(other);
  const beat = await cloud.send(shop, "/relay/heartbeat", {
    method: "POST",
    body: JSON.stringify({ orgId: other.licence.org, licenceId: other.licence.id }),
  });
  expect(beat.status).toBe(200);
  expect((await relayRow(other))!.lastSeenAt).toBeNull();
  // A licence naming a shop whose relay belongs to another licence is not enrolled for it.
  const impostor = await cloud.box({ org: shop.licence.org });
  expect((await cloud.send(impostor, "/relay/status")).status).toBe(403);
});
