// The update routes are an owner's action on a box and absent on the cloud; the box's refusals reach the owner as written.
import { expect, test, vi } from "vite-plus/test";
import { BoxUpdateError, createApi, type ApiAuthentication, type BoxUpdates } from "@shopper/api";

const principal = {
  orgId: "019a5e2c-7d1b-7c3e-9f2a-8b4d6e1f0a37",
  userId: "019a5e2c-7d1b-7c3e-9f2a-8b4d6e1f0a38",
};
function auth(held: string[]): ApiAuthentication {
  return {
    resolvePrincipal: async (request) =>
      request.headers.get("x-user") ? (principal as never) : null,
    hasPermission: async (_principal, code) => held.includes(code),
  };
}
const overview = {
  running: { version: "1.0.0", slot: "a" as const },
  bundles: [],
};
function updates(): BoxUpdates {
  return {
    overview: vi.fn(async () => overview),
    install: vi.fn(async () => {}),
    schedule: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
  };
}
const call = (
  api: ReturnType<typeof createApi>,
  method: string,
  path: string,
  body?: unknown,
  signedIn = true,
) =>
  api.request(path, {
    method,
    headers: { "content-type": "application/json", ...(signedIn ? { "x-user": "1" } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

test("the cloud mounts no update routes", async () => {
  const cloud = createApi({ authentication: auth(["billing.manage"]) });
  expect((await call(cloud, "GET", "/updates")).status).toBe(404);
  expect((await call(cloud, "POST", "/updates/install", { file: "a.tgz" })).status).toBe(404);
});

test("only an owner (billing.manage) reads or starts updates; now and after closing are different answers", async () => {
  const service = updates();
  const box = createApi({ authentication: auth(["billing.manage"]), updates: service });
  const staff = createApi({ authentication: auth(["products.read"]), updates: service });
  expect((await call(box, "GET", "/updates", undefined, false)).status).toBe(401);
  expect((await call(staff, "GET", "/updates")).status).toBe(403);
  expect((await call(staff, "POST", "/updates/install", { file: "a.tgz" })).status).toBe(403);
  expect((await call(box, "GET", "/updates")).status).toBe(200);

  expect((await call(box, "POST", "/updates/install", { file: "../../etc/passwd" })).status).toBe(
    400,
  );
  expect((await call(box, "POST", "/updates/install", { file: "a.tgz", extra: 1 })).status).toBe(
    400,
  );
  const now = await call(box, "POST", "/updates/install", { file: "a.tgz" });
  expect(now.status).toBe(202);
  expect(service.install).toHaveBeenCalledWith("a.tgz", {
    orgId: principal.orgId,
    actorId: principal.userId,
  });
  const at = "2026-11-12T23:00:00.000Z";
  expect((await call(box, "POST", "/updates/install", { file: "a.tgz", at })).status).toBe(201);
  expect(service.schedule).toHaveBeenCalledWith(
    "a.tgz",
    at,
    expect.objectContaining({ orgId: principal.orgId }),
  );
  expect((await call(box, "POST", "/updates/cancel", {})).status).toBe(204);
  expect(service.cancel).toHaveBeenCalledOnce();
});

test("a refusal reaches the owner with the box's own sentence and status", async () => {
  const service = updates();
  service.install = vi.fn(async () => {
    throw new BoxUpdateError(422, "This update was built on 5 Jan 2027, after your updates ended.");
  });
  const response = await call(
    createApi({ authentication: auth(["billing.manage"]), updates: service }),
    "POST",
    "/updates/install",
    { file: "a.tgz" },
  );
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({
    error: "This update was built on 5 Jan 2027, after your updates ended.",
  });
});
