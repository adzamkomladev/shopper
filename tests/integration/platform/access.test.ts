// The platform API answers only Shopper staff: members of the platform org holding the platform permission. A shop's
// owner, whatever their permissions there, and a platform member without it are refused.
import { expect, test } from "vite-plus/test";
import { seedPlatformRoles } from "@shopper/auth";
import { asStaff, context, cookies, db, platformContext, staffApi, tenantApi } from "./support";
import { request } from "../auth/setup";

test("the platform org is public, so the admin app can sign staff in to it", async () => {
  const reply = await staffApi.request("/platform/org");
  expect(reply.status).toBe(200);
  expect(await reply.json()).toMatchObject({ id: platformContext.orgId });
});

test("only platform members holding the permission reach the platform API", async () => {
  expect((await staffApi.request("/platform/kyb")).status).toBe(401);
  for (const path of ["/platform/kyb", "/platform/tenants"]) {
    expect((await request(tenantApi, cookies.get("superadmin")!, path)).status).toBe(403);
    expect((await asStaff(path, "GET", undefined, "cashier")).status).toBe(403);
    expect((await asStaff(path)).status).toBe(200);
  }
});

test("a shop that grants itself a platform code is still refused: staff are the platform org's members", async () => {
  await seedPlatformRoles(db, { orgId: context.orgId, appVersion: "test" }, undefined);
  expect((await request(tenantApi, cookies.get("superadmin")!, "/platform/kyb")).status).toBe(403);
});
