// Day 26 S1: one distributed RateLimiter port budgets every unauthenticated entry point in serveRuntime.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import { ratePolicies } from "@shopper/ports";
import { boxCache, boxRateLimiter } from "@shopper/adapters-box";
import { serveRuntime, type RuntimeOptions } from "@shopper/api/runtime";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { postgresFixture } from "../../fixtures/postgres";

const baseURL = "http://localhost:8787";
let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let db: RuntimeOptions["database"];
const cache = boxCache(":memory:");
const mart = provisioningContext();
const annex = provisioningContext();
const slug = `mart-${mart.orgId.slice(-12)}`;

beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
  await provisionOrg(db, mart, { name: "Mart", slug });
  await provisionOrg(db, annex, { name: "Annex" });
});
afterAll(async () => {
  cache.close();
  await pool?.end();
  await fixture?.close();
});

function runtime() {
  const rateLimiter = boxRateLimiter();
  return (path: string, clientIP: string, init: RequestInit = {}, orgId?: string) =>
    serveRuntime(new Request(`${baseURL}${path}`, init), {
      database: db,
      cache: cache.cache,
      rateLimiter,
      secret: "rate-limit-integration-secret-more-than-32-chars",
      baseURL,
      orgId,
      clientIP,
    });
}
const post = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(body),
});

test("sign-in guesses from one IP are refused with 429 and Retry-After once the auth budget is spent", async () => {
  const send = runtime();
  const guess = (ip: string, email: string) =>
    send("/api/auth/sign-in/email", ip, post({ email, password: "wrong-password-1" }), mart.orgId);
  for (let call = 0; call < ratePolicies.auth.limit; call += 1)
    expect((await guess("203.0.113.10", `victim${call}@example.com`)).status).not.toBe(429);
  const refused = await guess("203.0.113.10", "someone-else@example.com");
  expect(refused.status).toBe(429);
  expect(Number(refused.headers.get("Retry-After"))).toBe(ratePolicies.auth.period);
  expect((await guess("203.0.113.11", "fresh@example.com")).status).not.toBe(429);
});

test("one account is budgeted across many IPs, so rotating addresses does not buy more guesses", async () => {
  const send = runtime();
  const guess = (ip: string) =>
    send(
      "/api/auth/sign-in/email",
      ip,
      post({ email: "Owner@Example.com", password: "wrong-password-1" }),
      mart.orgId,
    );
  for (let call = 0; call < ratePolicies.auth.limit; call += 1)
    expect((await guess(`198.51.100.${call + 1}`)).status).not.toBe(429);
  expect((await guess("198.51.100.200")).status).toBe(429);
});

test("a form-encoded sign-in spends the same account budget as JSON", async () => {
  const send = runtime();
  const guess = (ip: string) =>
    send(
      "/api/auth/sign-in/email",
      ip,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email: "Form@Example.com", password: "wrong-password-1" }),
      },
      mart.orgId,
    );
  for (let call = 0; call < ratePolicies.auth.limit; call += 1)
    expect((await guess(`192.0.2.${call + 1}`)).status).not.toBe(429);
  expect((await guess("192.0.2.200")).status).toBe(429);
});

test("cashier sign-in is budgeted per shop and IP, till enrolment per IP across shops", async () => {
  const send = runtime();
  const login = (orgId: string) =>
    send(
      "/cashiers/login",
      "203.0.113.20",
      post(
        {
          deviceId: crypto.randomUUID(),
          deviceToken: "0".repeat(64),
          email: "a@b.co",
          password: "x",
        },
        { "X-Shopper-Org": orgId },
      ),
    );
  for (let call = 0; call < ratePolicies.cashier.limit; call += 1)
    expect((await login(mart.orgId)).status).not.toBe(429);
  expect((await login(mart.orgId)).status).toBe(429);
  expect((await login(annex.orgId)).status).not.toBe(429);

  // A different shop each time, so no shop's own five-guess lock is what refuses.
  const enrol = () => {
    const orgId = crypto.randomUUID();
    return send(
      "/devices/enroll",
      "203.0.113.21",
      post({ orgId, code: "000000", name: "Guess" }, { "X-Shopper-Org": orgId }),
    );
  };
  for (let call = 0; call < ratePolicies.enrol.limit; call += 1)
    expect((await enrol()).status).not.toBe(429);
  expect((await enrol()).status).toBe(429);
});

test("the shop-code lookup and statement links share the public budget per IP", async () => {
  const send = runtime();
  for (let call = 0; call < ratePolicies.public.limit; call += 1)
    expect((await send(`/orgs/${slug}`, "203.0.113.30")).status).toBe(200);
  expect((await send(`/orgs/${slug}`, "203.0.113.30")).status).toBe(429);
  expect((await send(`/orgs/${slug}`, "203.0.113.31")).status).toBe(200);
});

test("HEAD reads and every onboarding POST spend the same budgets as their GET and sign-up", async () => {
  const send = runtime();
  for (let call = 0; call < ratePolicies.public.limit; call += 1)
    expect((await send(`/orgs/${slug}`, "203.0.113.40", { method: "HEAD" })).status).not.toBe(429);
  expect((await send(`/orgs/${slug}`, "203.0.113.40")).status).toBe(429);
  const resend = () =>
    send(`/onboarding/${crypto.randomUUID()}/resend`, "203.0.113.41", post({ token: "invalid" }));
  for (let call = 0; call < ratePolicies.auth.limit; call += 1)
    expect((await resend()).status).not.toBe(429);
  expect((await resend()).status).toBe(429);
});
