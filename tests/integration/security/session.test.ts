// Day 26 S3: session cookies, cross-site refusals and response headers on the shared runtime.
import { afterAll, beforeAll, beforeEach, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { boxRateLimiter } from "@shopper/adapters-box";
import { serveRuntime } from "@shopper/api/runtime";
import {
  authRequest,
  freshPortalTenants,
  portalBootstrap,
  portalOptions,
  portalOrigin,
  portalPassword,
  sessionCookie,
  startPortalFixture,
  stopPortalFixture,
} from "../../support/portal/runtime";

beforeAll(startPortalFixture);
afterAll(stopPortalFixture);
beforeEach(freshPortalTenants);

const json = { "content-type": "application/json" };

/** Bootstraps tenant 0's owner and returns the sign-in response, so a test can read its cookie. */
async function signedIn(rememberMe = true) {
  const email = `owner-${crypto.randomUUID().slice(0, 8)}@portal.test`;
  const signup = await authRequest(0, "/api/auth/sign-up/email", {
    method: "POST",
    headers: { ...json, Origin: portalOrigin, "X-Shopper-Bootstrap-Token": portalBootstrap },
    body: JSON.stringify({ name: "Session Owner", email, password: portalPassword }),
  });
  expect(signup.status).toBe(200);
  const signin = await authRequest(0, "/api/auth/sign-in/email", {
    method: "POST",
    headers: { ...json, Origin: portalOrigin },
    body: JSON.stringify({ email, password: portalPassword, rememberMe }),
  });
  expect(signin.status).toBe(200);
  return signin;
}

test("over https the session cookie is __Secure-, Secure, HttpOnly, SameSite=Lax and lives 12 hours", async () => {
  const signin = await signedIn();
  const cookie = signin.headers.get("set-cookie")!;
  expect(cookie).toMatch(/__Secure-better-auth\.session_token=/);
  expect(cookie).toMatch(/;\s*Secure/i);
  expect(cookie).toMatch(/;\s*HttpOnly/i);
  expect(cookie).toMatch(/;\s*SameSite=Lax/i);
  const maxAge = Number(cookie.match(/Max-Age=(\d+)/i)?.[1]);
  expect(maxAge).toBe(12 * 60 * 60);
});

// Better Auth gives a browser-session sign-in a fixed day on the server; the shift's 12 hours still apply.
test("a sign-in without remember-me ends on the server within 12 hours too", async () => {
  const cookie = sessionCookie(await signedIn(false));
  const token = decodeURIComponent(cookie.split("=")[1]!).split(".")[0]!;
  const [row] = await portalOptions(0)
    .database.select({ expiresAt: schema.session.expiresAt })
    .from(schema.session)
    .where(eq(schema.session.token, token));
  expect(row!.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 12 * 3_600_000);
});

test("a cookie-bearing write is refused from another site or with no origin at all", async () => {
  const cookie = sessionCookie(await signedIn());
  const write = (headers: Record<string, string>) =>
    authRequest(0, "/stores", {
      method: "POST",
      headers: { ...json, cookie, ...headers },
      body: JSON.stringify({ name: "Forged store" }),
    });
  expect((await write({ Origin: "https://evil.test" })).status).toBe(403);
  expect((await write({})).status).toBe(403);
  expect((await write({ "Sec-Fetch-Site": "cross-site" })).status).toBe(403);
  // A form post from a sandboxed frame says Origin: null.
  expect((await write({ Origin: "null" })).status).toBe(403);

  expect((await write({ Origin: portalOrigin })).status).toBe(201);
  expect((await write({ "Sec-Fetch-Site": "same-origin" })).status).toBe(201);
});

test("a write without a cookie is not judged by origin: device and webhook callers have none", async () => {
  const response = await authRequest(0, "/stores", {
    method: "POST",
    headers: json,
    body: JSON.stringify({ name: "No session" }),
  });
  // Unauthenticated, not a CSRF refusal.
  expect(response.status).toBe(401);
});

test("every API answer says nosniff, no-referrer and no framing; signed-in answers are never cached", async () => {
  const cookie = sessionCookie(await signedIn());
  const signedInAnswer = await authRequest(0, "/stores", { headers: { cookie } });
  expect(signedInAnswer.status).toBe(200);
  for (const response of [signedInAnswer, await authRequest(0, "/orgs/nope")]) {
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("strict-transport-security")).toMatch(/max-age=\d{7,}/);
  }
  expect(signedInAnswer.headers.get("cache-control")).toBe("no-store");
});

test("plain http (a box on the shop LAN) sends no HSTS and no Secure cookie", async () => {
  const options = {
    ...portalOptions(0),
    baseURL: "http://box.local",
    rateLimiter: boxRateLimiter(),
  };
  const response = await serveRuntime(new Request("http://box.local/orgs/nope"), options);
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("strict-transport-security")).toBeNull();
});

test("signing out revokes the session on the server, not just in the browser", async () => {
  const cookie = sessionCookie(await signedIn());
  const out = await authRequest(0, "/api/auth/sign-out", {
    method: "POST",
    headers: { ...json, cookie, Origin: portalOrigin },
    body: "{}",
  });
  expect(out.status).toBe(200);
  // Replaying the old cookie is no longer a session.
  expect(
    await (await authRequest(0, "/api/auth/get-session", { headers: { cookie } })).json(),
  ).toBeNull();
  expect((await authRequest(0, "/stores", { headers: { cookie } })).status).toBe(401);
});

test("a missing or short signing secret refuses to serve instead of signing with it", async () => {
  const at = (overrides: Partial<ReturnType<typeof portalOptions>>) =>
    serveRuntime(new Request(`${portalOrigin}/stores`), { ...portalOptions(0), ...overrides });
  expect((await at({ secret: "short-secret" })).status).toBe(503);
  expect((await at({ secret: "" })).status).toBe(503);
  expect((await at({ linkSecret: "short-link-secret" })).status).toBe(503);
  // A missing link secret only turns emailed links off; sign-in still works.
  expect((await at({ linkSecret: undefined })).status).toBe(401);
});
