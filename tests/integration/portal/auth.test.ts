import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import {
  authRequest,
  portalBootstrap,
  portalPassword,
  portalTenantSlug,
  sessionCookie,
  startPortalFixture,
  stopPortalFixture,
} from "../../support/portal/runtime";

beforeAll(startPortalFixture);
afterAll(stopPortalFixture);

const body = (email: string, name = "Portal Owner") => ({ name, email, password: portalPassword });
const post = (index: 0 | 1, path: string, data: unknown, headers: Record<string, string> = {}) =>
  authRequest(index, path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(data),
  });

test("signup and sign-in expose only the portal user projection and persist an HttpOnly session", async () => {
  const email = "owner@portal.test";
  const credentials = body(email);
  const signup = await post(0, "/api/auth/sign-up/email", credentials, {
    "X-Shopper-Bootstrap-Token": portalBootstrap,
    Origin: "https://portal.test",
  });
  expect(signup.status).toBe(200);
  const created = await signup.json();
  expect(created).toEqual({ user: { id: expect.any(String), name: credentials.name, email } });
  expect(created).not.toHaveProperty("token");
  expect(created).not.toHaveProperty("session");

  const signin = await post(
    0,
    "/api/auth/sign-in/email",
    { email, password: portalPassword },
    {
      Origin: "https://portal.test",
    },
  );
  expect(signin.status).toBe(200);
  expect(await signin.json()).toEqual({ user: created.user });
  expect(signin.headers.get("set-cookie")).toMatch(/HttpOnly/i);
  const cookie = sessionCookie(signin);

  const restored = await authRequest(0, "/api/auth/get-session", { headers: { cookie } });
  expect(restored.status).toBe(200);
  expect(await restored.json()).toEqual({ user: created.user });
  expect(await (await authRequest(0, "/api/auth/get-session")).json()).toBeNull();
});

test("tenant scoped sessions return null outside their tenant and reject foreign-origin mutations", async () => {
  const email = "scoped@portal.test";
  const credentials = body(email, "Scoped Owner");
  const signup = await post(0, "/api/auth/sign-up/email", credentials, {
    "X-Shopper-Bootstrap-Token": portalBootstrap,
    Origin: "https://portal.test",
  });
  expect(signup.status).toBe(200);
  const signin = await post(0, "/api/auth/sign-in/email", {
    email,
    password: portalPassword,
  });
  const cookie = sessionCookie(signin);

  expect(
    await (await authRequest(1, "/api/auth/get-session", { headers: { cookie } })).json(),
  ).toBeNull();
  const denied = await post(
    0,
    "/api/auth/sign-in/email",
    {
      email,
      password: portalPassword,
    },
    { Origin: "https://attacker.test" },
  );
  expect(denied.status).toBe(403);
  expect(await denied.json()).toMatchObject({ error: "Origin is not allowed" });
});

test("simultaneous tenant sign-ins keep each cookie bound to its own identity", async () => {
  const inputs = [0, 1].map((index) => ({
    index: index as 0 | 1,
    email: `owner-${index}@portal.test`,
    name: `Tenant ${index} Owner`,
  }));
  const signups = await Promise.all(
    inputs.map(({ index, email, name }) =>
      post(index, "/api/auth/sign-up/email", body(email, name), {
        "X-Shopper-Bootstrap-Token": portalBootstrap,
        Origin: "https://portal.test",
      }),
    ),
  );
  expect(signups.map(({ status }) => status)).toEqual([200, 200]);
  const signins = await Promise.all(
    inputs.map(({ index, email }) =>
      post(index, "/api/auth/sign-in/email", {
        email,
        password: portalPassword,
      }),
    ),
  );
  const sessions = await Promise.all(
    signins.map((response, index) =>
      authRequest(inputs[index].index, "/api/auth/get-session", {
        headers: { cookie: sessionCookie(response) },
      }).then((result) => result.json()),
    ),
  );
  expect(sessions[0]).toEqual({
    user: { id: expect.any(String), name: inputs[0].name, email: inputs[0].email },
  });
  expect(sessions[1]).toEqual({
    user: { id: expect.any(String), name: inputs[1].name, email: inputs[1].email },
  });
  expect(sessions[0].user.id).not.toBe(sessions[1].user.id);
  expect(portalTenantSlug(0)).not.toBe(portalTenantSlug(1));
});
