// v1.5 Day 46: Shopper staff enrol an on-prem box with its relay org, switch the Online Orders add-on and revoke a
// licence. A shop's own owner cannot, and every change is in the platform org's audit chain.
import { beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { createApi } from "@shopper/api";
import { seedPlatformRoles } from "@shopper/auth";
import { generateKey } from "@shopper/core/licence";
import { auth, cookies, db, otherAuth, otherContext, context, request } from "../auth/setup";
import { relayCloud, relayRow } from "./support";

let cloud: Awaited<ReturnType<typeof relayCloud>>;
let staff: ReturnType<typeof createApi>;
let shopApi: ReturnType<typeof createApi>;

beforeAll(async () => {
  cloud = await relayCloud();
  await db.update(schema.org).set({ slug: "shopper" }).where(eq(schema.org.id, otherContext.orgId));
  await seedPlatformRoles(db, otherContext, undefined);
  const options = {
    database: db,
    platform: { orgSlug: "shopper" },
    licenceSigningKey: cloud.issuer.privateKey,
  };
  staff = createApi({ ...options, authentication: otherAuth });
  shopApi = createApi({ ...options, authentication: auth });
});

const asStaff = (path: string, method = "GET", body?: unknown) =>
  request(staff, cookies.get("other")!, path, method, body);
const platformAudit = (action: string) =>
  db
    .select()
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.orgId, otherContext.orgId), eq(schema.auditLog.command, action)));

test("staff enrol a box: its relay org is created in relay mode and it can sign in", async () => {
  const box = await cloud.box({ site: "Kumasi Fresh" });
  const enrolled = await asStaff("/platform/relays", "POST", {
    licence: box.licence,
    onlineOrders: true,
  });
  expect(enrolled.status).toBe(201);
  expect(await enrolled.json()).toMatchObject({
    orgId: box.licence.org,
    licenceId: box.licence.id,
    onlineOrders: true,
    revokedAt: null,
  });
  const [org] = await db.select().from(schema.org).where(eq(schema.org.id, box.licence.org));
  expect(org).toMatchObject({ mode: "relay", name: "Kumasi Fresh" });
  expect((await cloud.send(box, "/relay/status")).status).toBe(200);
  // Enrolling again is harmless: the same row, the flag as given.
  expect(
    (await asStaff("/platform/relays", "POST", { licence: box.licence, onlineOrders: true }))
      .status,
  ).toBe(201);
  expect(await platformAudit("platform.relay.enrol")).toHaveLength(2);

  expect(
    (await asStaff(`/platform/relays/${box.licence.id}`, "PATCH", { onlineOrders: false })).status,
  ).toBe(200);
  expect((await relayRow(box))!.onlineOrders).toBe(false);
  expect((await cloud.send(box, "/relay/status")).status).toBe(403);

  expect((await asStaff(`/platform/relays/${box.licence.id}/revoke`, "POST")).status).toBe(200);
  expect((await relayRow(box))!.revokedAt).toBeInstanceOf(Date);
  expect(await platformAudit("platform.relay.revoke")).toHaveLength(1);
  expect(await platformAudit("platform.relay.online_orders")).toHaveLength(1);
});

test("a licence Shopper did not sign, or one for a full cloud shop, is not enrolled", async () => {
  const forged = await cloud.box({}, (await generateKey()).privateKey);
  expect((await asStaff("/platform/relays", "POST", { licence: forged.licence })).status).toBe(422);
  // The licence names a shop that already trades in the cloud: it stays a full shop.
  const clash = await cloud.box({ org: context.orgId });
  const refused = await asStaff("/platform/relays", "POST", { licence: clash.licence });
  expect(refused.status).toBe(409);
  const [org] = await db.select().from(schema.org).where(eq(schema.org.id, context.orgId));
  expect(org!.mode).toBe("full");
  expect((await asStaff("/platform/relays", "POST", { licence: { format: "lic/1" } })).status).toBe(
    400,
  );
});

test("a shop's own owner cannot enrol, switch or revoke", async () => {
  const box = await cloud.box();
  const asOwner = (path: string, method: string, body?: unknown) =>
    request(shopApi, cookies.get("superadmin")!, path, method, body);
  expect((await asOwner("/platform/relays", "POST", { licence: box.licence })).status).toBe(403);
  expect((await asOwner(`/platform/relays/${box.licence.id}/revoke`, "POST")).status).toBe(403);
  expect(await relayRow(box)).toBeUndefined();
});
