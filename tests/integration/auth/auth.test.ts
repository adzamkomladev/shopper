import { expect, test } from "vite-plus/test";
import { createDeviceService } from "@shopper/auth";
import { createApi } from "@shopper/api";
import {
  baseURL,
  bootstrapToken,
  db,
  context,
  otherContext,
  auth,
  otherAuth,
  api,
  otherApi,
  deviceCache,
  cookies,
  trustedIP,
  signUp,
  request,
} from "./setup";

test("Better Auth signs in provisioned tenants and binds cookies and API scope to the selected tenant", async () => {
  const owner = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("superadmin")! } }),
  );
  expect(owner).toMatchObject({ orgId: context.orgId, roleName: "superadmin" });
  expect(
    await otherAuth.resolvePrincipal(
      new Request(baseURL, { headers: { cookie: cookies.get("superadmin")! } }),
    ),
  ).toBeNull();
  expect((await request(otherApi, cookies.get("superadmin")!, "/stores")).status).toBe(401);

  const ownerStore = await request(api, cookies.get("superadmin")!, "/stores", "POST", {
    name: "Owner tenant store",
  });
  const otherStore = await request(otherApi, cookies.get("other")!, "/stores", "POST", {
    name: "Other tenant store",
  });
  expect(ownerStore.status).toBe(201);
  expect(otherStore.status).toBe(201);
  const ownerRows = await request(
    api,
    cookies.get("superadmin")!,
    `/stores?orgId=${otherContext.orgId}`,
  ).then((r) => r.json());
  expect(ownerRows).toHaveLength(1);
  expect(ownerRows[0]).toMatchObject({ orgId: context.orgId, name: "Owner tenant store" });

  expect((await signUp(auth, "another-owner@example.com", bootstrapToken)).status).toBe(403);
  const createOrg = await auth.handler(
    new Request(`${baseURL}/api/auth/organization/create`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookies.get("superadmin")! },
      body: JSON.stringify({ name: "Unprovisioned organization", slug: "unprovisioned" }),
    }),
  );
  expect(createOrg.status).toBe(404);
});

test("actual cookie sessions enforce the five seeded role matrices across store, branch, and tax APIs", async () => {
  const ownerCookie = cookies.get("superadmin")!;
  const storeResponse = await request(api, ownerCookie, "/stores", "POST", {
    name: "Role matrix store",
  });
  const store = await storeResponse.json();
  const branchResponse = await request(api, ownerCookie, "/branches", "POST", {
    name: "Role matrix branch",
    storeId: store.id,
  });
  const branch = await branchResponse.json();
  expect(storeResponse.status).toBe(201);
  expect(branchResponse.status).toBe(201);

  const roleNames = ["admin", "accountant", "inventory", "cashier", "superadmin"];
  for (const roleName of roleNames) {
    const cookie = cookies.get(roleName)!;
    const taxStatus = ["superadmin", "admin", "accountant"].includes(roleName) ? 200 : 403;
    const operations = [
      ["GET", "/stores", undefined, 200],
      ["GET", `/stores/${store.id}`, undefined, 200],
      ["POST", "/stores", { name: `${roleName} temporary store` }, 201],
      ["PATCH", `/stores/${store.id}`, { name: `${roleName} store update` }, 200],
      ["GET", "/branches", undefined, 200],
      ["GET", `/branches/${branch.id}`, undefined, 200],
      ["POST", "/branches", { name: `${roleName} temporary branch`, storeId: store.id }, 201],
      ["PATCH", `/branches/${branch.id}`, { name: `${roleName} branch update` }, 200],
      ["DELETE", `/branches/${branch.id}`, undefined, 204],
      ["DELETE", `/stores/${store.id}`, undefined, 204],
    ] as const;
    for (const [method, path, body, successStatus] of operations) {
      const response = await request(api, cookie, path, method, body);
      expect(response.status, `${roleName} ${method} ${path}`).toBe(
        roleName === "superadmin" ? successStatus : 403,
      );
      if (roleName === "superadmin" && method === "POST" && path === "/stores") {
        const temporaryStore = await response.json();
        expect((await request(api, cookie, `/stores/${temporaryStore.id}`, "DELETE")).status).toBe(
          204,
        );
      }
      if (roleName === "superadmin" && method === "POST" && path === "/branches") {
        const temporaryBranch = await response.json();
        expect(
          (await request(api, cookie, `/branches/${temporaryBranch.id}`, "DELETE")).status,
        ).toBe(204);
      }
    }
    expect((await request(api, cookie, "/tax-rules?on=2026-01-01")).status).toBe(taxStatus);
    const principal = await auth.resolvePrincipal(new Request(baseURL, { headers: { cookie } }));
    expect(principal).not.toBeNull();
    for (const code of ["device.enroll", "device.revoke", "cashier.pin.assign"])
      expect(await auth.hasPermission(principal!, code)).toBe(
        ["superadmin", "admin"].includes(roleName),
      );
  }
});

test("actual cookie sessions enforce enrollment, PIN assignment, and device revocation endpoints", async () => {
  const ownerCookie = cookies.get("superadmin")!;
  const storeResponse = await request(api, ownerCookie, "/stores", "POST", {
    name: "Device auth store",
  });
  const store = await storeResponse.json();
  const branchResponse = await request(api, ownerCookie, "/branches", "POST", {
    name: "Device auth branch",
    storeId: store.id,
  });
  const branch = await branchResponse.json();
  expect(storeResponse.status).toBe(201);
  expect(branchResponse.status).toBe(201);

  const deviceService = createDeviceService(
    db,
    deviceCache.cache,
    context.appVersion,
    context.orgId,
  );
  const deviceApi = createApi({ database: db, authentication: auth, devices: deviceService });
  const enrollmentResponse = await request(deviceApi, ownerCookie, "/devices/enrollment", "POST", {
    branchId: branch.id,
  });
  expect(enrollmentResponse.status).toBe(201);
  const enrollment = await enrollmentResponse.json();
  const enrolledResponse = await deviceApi.request("/devices/enroll", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Shopper-Client-IP": trustedIP() },
    body: JSON.stringify({
      orgId: context.orgId,
      code: enrollment.code,
      name: "Permission matrix till",
    }),
  });
  expect(enrolledResponse.status).toBe(201);
  const enrolled = await enrolledResponse.json();
  const cashier = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("cashier")! } }),
  );
  expect(cashier).not.toBeNull();

  for (const roleName of ["superadmin", "admin", "accountant", "inventory", "cashier"]) {
    const cookie = cookies.get(roleName)!;
    const status = ["superadmin", "admin"].includes(roleName) ? 200 : 403;
    expect(
      (await request(deviceApi, cookie, "/devices/enrollment", "POST", { branchId: branch.id }))
        .status,
      `${roleName} POST /devices/enrollment`,
    ).toBe(status === 200 ? 201 : status);
    expect(
      (
        await request(deviceApi, cookie, "/cashiers/pin", "POST", {
          userId: cashier!.userId,
          pin: "4826",
        })
      ).status,
      `${roleName} POST /cashiers/pin`,
    ).toBe(status);
    expect(
      (await request(deviceApi, cookie, "/devices/revoke", "POST", { deviceId: enrolled.deviceId }))
        .status,
      `${roleName} POST /devices/revoke`,
    ).toBe(status);
  }
});
