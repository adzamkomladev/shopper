import { beforeAll, expect, test } from "vite-plus/test";
import { createDeviceService } from "@shopper/auth/devices";
import { deviceListResponse } from "@shopper/auth/schemas";
import { createApi } from "@shopper/api";
import * as v from "valibot";
import {
  api,
  auth,
  context,
  cookies,
  db,
  deviceCache,
  otherApi,
  otherContext,
  otherAuth,
  request,
  trustedIP,
} from "../setup";

let deviceApi: ReturnType<typeof createApi>;
let otherDeviceApi: ReturnType<typeof createApi>;
beforeAll(() => {
  deviceApi = createApi({
    database: db,
    authentication: auth,
    devices: createDeviceService(db, deviceCache.cache, context.appVersion, context.orgId),
  });
  otherDeviceApi = createApi({
    database: db,
    authentication: otherAuth,
    devices: createDeviceService(db, deviceCache.cache, context.appVersion, otherContext.orgId),
  });
});

async function enroll(
  app: typeof api,
  deviceApp: typeof deviceApi,
  tenantOrgId: string,
  cookie: string,
  name: string,
) {
  const storeResponse = await request(app, cookie, "/stores", "POST", { name: `${name} store` });
  const store = await storeResponse.json();
  const branchResponse = await request(app, cookie, "/branches", "POST", {
    name: `${name} branch`,
    storeId: store.id,
  });
  const branch = await branchResponse.json();
  const issueResponse = await request(deviceApp, cookie, "/devices/enrollment", "POST", {
    branchId: branch.id,
  });
  const enrollment = await issueResponse.json();
  const response = await deviceApp.request("/devices/enroll", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Shopper-Client-IP": trustedIP() },
    body: JSON.stringify({ orgId: tenantOrgId, code: enrollment.code, name }),
  });
  return { branchId: branch.id, response, enrollment };
}

test("device list is permission checked, tenant scoped, redacted, and reports revocation", async () => {
  const owner = cookies.get("superadmin")!;
  const admin = cookies.get("admin")!;
  const cashier = cookies.get("cashier")!;
  const first = await enroll(api, deviceApi, context.orgId, owner, "List device active");
  const second = await enroll(api, deviceApi, context.orgId, owner, "List device revoked");
  const other = await enroll(
    otherApi,
    otherDeviceApi,
    otherContext.orgId,
    cookies.get("other")!,
    "Other tenant device",
  );
  expect(first.response.status).toBe(201);
  expect(second.response.status).toBe(201);
  expect(other.response.status).toBe(201);
  const firstCreated = await first.response.json();
  const secondCreated = await second.response.json();
  const otherCreated = await other.response.json();

  const revoke = await request(deviceApi, owner, "/devices/revoke", "POST", {
    deviceId: secondCreated.deviceId,
  });
  expect(revoke.status).toBe(200);

  for (const cookie of [owner, admin])
    expect((await request(deviceApi, cookie, "/devices")).status).toBe(200);
  expect((await request(deviceApi, cashier, "/devices")).status).toBe(403);

  const response = await request(deviceApi, owner, "/devices");
  const rows = await response.json();
  expect(response.status).toBe(200);
  expect(v.safeParse(deviceListResponse, rows).success).toBe(true);
  expect(rows).toHaveLength(2);
  expect(rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: firstCreated.deviceId,
        name: "List device active",
        branchId: first.branchId,
        status: "active",
        revokedAt: null,
      }),
      expect.objectContaining({
        id: secondCreated.deviceId,
        name: "List device revoked",
        branchId: second.branchId,
        status: "revoked",
        revokedAt: expect.any(String),
      }),
    ]),
  );
  expect(rows.some((row: { id: string }) => row.id === otherCreated.deviceId)).toBe(false);
  expect(JSON.stringify(rows)).not.toContain(firstCreated.deviceToken);
  expect(JSON.stringify(rows)).not.toContain(secondCreated.deviceToken);
  expect(JSON.stringify(rows)).not.toContain(first.enrollment.code);
  expect(JSON.stringify(rows)).not.toContain("pinHash");
  expect(JSON.stringify(rows)).not.toContain("tokenHash");
});
