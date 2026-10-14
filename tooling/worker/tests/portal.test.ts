import { env } from "cloudflare:test";
import { beforeAll, expect, test } from "vitest";
import { v7 } from "uuid";
import {
  cloudflareDatabase,
  cloudflarePortal,
  type CloudflareRuntimeEnvironment,
} from "@shopper/adapters-cf";
import { seedAuthRoles } from "@shopper/auth";
import { provisionOrg } from "@shopper/core";
import { buildInfo } from "@shopper/config";
import { cacheMigration } from "@shopper/db-sqlite";

const bindings = env as CloudflareRuntimeEnvironment;
const orgId = v7();
const slug = `worker-portal-${orgId}`;
const origin = "https://shopper.test";

beforeAll(async () => {
  await bindings.CACHE_DB.prepare(cacheMigration).run();
  const connection = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
  try {
    const context = { orgId, appVersion: buildInfo.version };
    await provisionOrg(connection.db, context, { name: "Native portal", slug });
    await seedAuthRoles(connection.db, context);
  } finally {
    await connection.close();
  }
});

test("portal handles the API prefix through native bindings without an edge service", async () => {
  const response = await cloudflarePortal(new Request(`${origin}/api/orgs/${slug}`), bindings);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: orgId, name: "Native portal" });
  const health = await cloudflarePortal(new Request(`${origin}/api/health`), bindings);
  expect(health.status).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok" });
});

test("portal returns JSON service errors when native runtime configuration is absent", async () => {
  const response = await cloudflarePortal(new Request(`${origin}/api/products`), {
    ...bindings,
    SHOPPER_AUTH_SECRET: undefined,
  });
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "Authentication service unavailable" });
});

test("native portal preserves HttpOnly cookies while hiding auth token and session internals", async () => {
  const email = `owner-${orgId}@portal.test`;
  const password = "Native-portal-test-password-123";
  const request = (path: string, body?: unknown, cookie?: string) =>
    new Request(`${origin}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        "X-Shopper-Org": orgId,
        "Content-Type": "application/json",
        "X-Shopper-Bootstrap-Token": bindings.SHOPPER_BOOTSTRAP_TOKEN ?? "",
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  const signup = await cloudflarePortal(
    request("/api/auth/sign-up/email", {
      email,
      password,
      name: "Portal Owner",
    }),
    bindings,
  );
  expect(signup.status).toBe(200);
  const created = await signup.json();
  expect(created).toEqual({ user: { id: expect.any(String), name: "Portal Owner", email } });
  const signin = await cloudflarePortal(
    request("/api/auth/sign-in/email", { email, password }),
    bindings,
  );
  expect(signin.status).toBe(200);
  expect(await signin.json()).toEqual(created);
  expect(signin.headers.get("set-cookie")).toMatch(/HttpOnly/i);
  const cookie = signin.headers
    .get("set-cookie")
    ?.match(/(?:__Secure-)?better-auth\.session_token=[^;,]+/)?.[0];
  expect(cookie).toBeTruthy();
  const session = await cloudflarePortal(
    request("/api/auth/get-session", undefined, cookie),
    bindings,
  );
  expect(session.status).toBe(200);
  expect(await session.json()).toEqual(created);
  const anonymous = await cloudflarePortal(request("/api/auth/get-session"), bindings);
  expect(await anonymous.json()).toBeNull();
});
