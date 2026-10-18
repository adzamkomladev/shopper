// The host's /api surface: guarded, proxied as the device principal, and local for the session endpoints.
import { afterEach, expect, test } from "vite-plus/test";
import { startUpstream } from "../../../../support/till/upstream";
import { ama, startStaffHost, type StaffHost } from "../../../../support/till/host/staff";

let ctx: StaffHost | undefined;
afterEach(async () => ctx?.close());

const reached = (c: StaffHost, path: string) =>
  c.upstream.requests.filter((request) => request.path === path);

async function signedIn() {
  ctx = await startStaffHost();
  await ctx.signIn(ama.email, ama.password);
  return ctx;
}

test("a signed-in admin's /api/products reaches upstream as the device principal with the org header", async () => {
  const c = await signedIn();
  const response = await c.call("/api/products?q=1", {
    headers: { authorization: "Bearer forged", "x-shopper-org": "other" },
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([]);
  const [request] = reached(c, "/products");
  expect(request!.headers).toMatchObject({
    authorization: `Bearer ${c.upstream.state.issued[0]!.token}`,
    "x-shopper-device-token": c.fixture.config.deviceToken,
    "x-shopper-org": c.fixture.config.identity.orgId,
  });
  expect(request!.headers.cookie).toBeUndefined();
});

test("/api without the desktop cookie is 401 and never reaches upstream", async () => {
  const c = await signedIn();
  expect((await fetch(`${c.base}/api/products`)).status).toBe(401);
  const forged = await fetch(`${c.base}/api/products`, {
    headers: { cookie: "shopper_desktop=guess" },
  });
  expect(forged.status).toBe(401);
  expect(
    (
      await fetch(`${c.base}/desktop/unlock`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: c.base },
        body: JSON.stringify({ capability: "wrong" }),
      })
    ).status,
  ).toBe(401);
  expect(reached(c, "/products")).toHaveLength(0);
});

test("the unlock cookie is HttpOnly and SameSite=Strict", async () => {
  const c = await signedIn();
  const { response } = await c.unlock();
  expect(response.status).toBe(204);
  expect(response.headers.getSetCookie()[0]).toMatch(/HttpOnly/i);
  expect(response.headers.getSetCookie()[0]).toMatch(/SameSite=Strict/i);
  expect(response.headers.getSetCookie()[0]).toMatch(/Path=\//);
});

test("a cross-origin POST is refused", async () => {
  const c = await signedIn();
  const post = (origin: string) =>
    c.call("/api/products", {
      method: "POST",
      origin,
      body: "{}",
      headers: { "content-type": "application/json" },
    });
  expect((await post("https://evil.example")).status).toBe(403);
  expect(reached(c, "/products")).toHaveLength(0);
  expect((await post(c.base)).status).toBe(200);
  expect(reached(c, "/products")).toHaveLength(1);
});

test("auth, sync and cashier routes are not proxied", async () => {
  const c = await signedIn();
  const logins = reached(c, "/cashiers/login").length;
  for (const path of [
    "/api/auth/sign-in/email",
    "/api/sync/push",
    "/api/cashiers/login",
    "/api/register/nope",
  ])
    expect((await c.call(path)).status).toBe(404);
  expect(reached(c, "/auth/sign-in/email")).toHaveLength(0);
  expect(reached(c, "/sync/push")).toHaveLength(0);
  expect(reached(c, "/cashiers/login")).toHaveLength(logins);
});

test("session endpoints answer from the host session, offline too", async () => {
  const c = await signedIn();
  await c.upstream.close();
  expect(await (await c.call("/api/auth/get-session")).json()).toEqual({
    user: { id: ama.userId, name: ama.name, email: ama.email },
  });
  expect(await (await c.call("/api/session/permissions")).json()).toEqual(ama.permissions);
  expect(await (await c.call("/api/orgs/current")).json()).toEqual({
    id: c.fixture.config.identity.orgId,
    name: c.fixture.config.identity.shopName,
  });
  const offline = await c.call("/api/products");
  expect(offline.status).toBe(503);
  expect(await offline.json()).toMatchObject({ error: expect.any(String) });

  const out = await c.call("/api/auth/sign-out", { method: "POST", body: "{}" });
  expect(await out.json()).toEqual({ success: true });
  // Signing out rotates the desktop cookie: the old one no longer opens /api.
  expect((await c.call("/api/auth/get-session")).status).toBe(401);
  await c.unlock();
  expect(await (await c.call("/api/auth/get-session")).json()).toBeNull();
  expect((await c.status()).user).toBeNull();
});

test("upstream Set-Cookie headers are stripped", async () => {
  const c = await signedIn();
  const response = await c.call("/api/products");
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toBeNull();
});

test("path tricks never reach upstream or a foreign host", async () => {
  const c = await signedIn();
  const evil = await startUpstream(() => Response.json({}));
  try {
    const before = c.upstream.requests.length;
    for (const path of [
      "/api//evil.example/x",
      `/api//127.0.0.1:${new URL(evil.url).port}/x`,
      "/api/%5Cevil.example/x",
      "/api/%2F%2Fevil.example/x",
      "/api/%61uth/x",
      "/api/%73ync/push",
      "/api/%63ashiers/login",
      "/api/%72egister/nope",
      "/api/%2561uth/x",
      "/api/%zz",
    ])
      expect([400, 404], path).toContain((await c.call(path)).status);
    expect(c.upstream.requests).toHaveLength(before);
    expect(evil.requests).toHaveLength(0);
  } finally {
    await evil.close();
  }
});

test("upstream CORS headers are stripped and an unknown email is omitted from get-session", async () => {
  const ctx2 = await startStaffHost();
  ctx = ctx2;
  // The preloaded dev session has no known email.
  expect(await (await ctx2.call("/api/auth/get-session")).json()).toEqual({
    user: { id: expect.any(String), name: expect.any(String) },
  });
  const response = await ctx2.call("/api/products");
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
});
