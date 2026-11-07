// Day 30 S3: the shop's sign-in over the shared runtime, as the shop Worker forwards it.
//   GET  /shop/:code                          -> { name, code }, 404 for an unknown code
//   POST /shop/:code/sign-in { phone, token }  -> 202 { loginId }
//   POST /shop/:code/signin/:id/resend        -> { sent }
//   POST /shop/:code/signin/:id/verify { code } -> 200 + shopper_shop cookie | 400 wrong | 423 locked | 410 spent
//   GET  /shop/account                        -> the signed-in account; 401 without a live session
//   POST /shop/signout                       -> the session ends and the cookie is cleared
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { loginCode } from "@shopper/core/shop";
import { cookieOf, freshIp, shopHttp } from "../../support/shop/http";
import { linkSecret, shopWorld } from "../../support/shop/world";

let world: Awaited<ReturnType<typeof shopWorld>>;
let http: ReturnType<typeof shopHttp>;
const checks: { token: string; ip?: string }[] = [];

beforeAll(async () => {
  world = await shopWorld();
  http = shopHttp(world, {
    turnstile: async (token, ip) => {
      checks.push({ token, ip });
      return token !== "bot";
    },
  });
});
afterAll(async () => {
  http?.close();
  await world?.close();
});

const start = (slug: string, phone: string, ip = freshIp(), token = "human") =>
  http.request(`/shop/${slug}/signin`, { body: { phone, turnstile: token }, ip });

test("a shop code names the shop; an unknown one is a plain 404", async () => {
  const found = await http.request(`/shop/${world.a.slug.toUpperCase()}`);
  expect(found.status).toBe(200);
  expect(await found.json()).toEqual({ name: `${world.a.slug} Mart`, code: world.a.slug });
  expect((await http.request("/shop/no-such-shop")).status).toBe(404);
});

test("sign in, read the account, sign out: the cookie is HttpOnly, Lax and lasts 30 days", async () => {
  const started = await start(world.a.slug, "024 300 1000", "198.51.100.77");
  expect(started.status).toBe(202);
  const { loginId } = (await started.json()) as { loginId: string };
  expect(checks.at(-1)).toEqual({ token: "human", ip: "198.51.100.77" });
  const verified = await http.request(`/shop/${world.a.slug}/signin/${loginId}/verify`, {
    body: { code: await loginCode(linkSecret, loginId, 1) },
  });
  expect(verified.status).toBe(200);
  const header = verified.headers.get("set-cookie")!;
  expect(header).toMatch(/^shopper_shop=[A-Za-z0-9_-]{43};/);
  expect(header).toMatch(/HttpOnly/i);
  expect(header).toMatch(/Secure/i);
  expect(header).toMatch(/SameSite=Lax/i);
  expect(header).toMatch(/Path=\//);
  expect(header).toMatch(/Max-Age=2592000/);
  const cookie = cookieOf(verified);

  const account = await http.request("/shop/account", { cookie });
  expect(account.status).toBe(200);
  expect(account.headers.get("cache-control")).toBe("no-store");
  expect(await account.json()).toMatchObject({ phone: "0243001000", shop: { code: world.a.slug } });

  const out = await http.request("/shop/signout", { method: "POST", cookie });
  expect(out.status).toBe(204);
  expect(out.headers.get("set-cookie")).toMatch(/shopper_shop=;.*Max-Age=0/i);
  expect((await http.request("/shop/account", { cookie })).status).toBe(401);
});

test("wrong, locked and spent codes answer distinctly", async () => {
  const { loginId } = (await (await start(world.a.slug, "0243002000")).json()) as {
    loginId: string;
  };
  const verify = (code: string) =>
    http.request(`/shop/${world.a.slug}/signin/${loginId}/verify`, { body: { code } });
  const right = await loginCode(linkSecret, loginId, 1);
  const wrong = right === "000000" ? "111111" : "000000";
  const first = await verify(wrong);
  expect(first.status).toBe(400);
  expect(await first.json()).toMatchObject({ attemptsLeft: 4 });
  for (let i = 0; i < 3; i++) await verify(wrong);
  expect((await verify(wrong)).status).toBe(423);
  expect((await verify(right)).status).toBe(423);
  expect((await verify("12ab")).status).toBe(400);

  const other = (await (await start(world.a.slug, "0243002001")).json()) as { loginId: string };
  const code = await loginCode(linkSecret, other.loginId, 1);
  const path = `/shop/${world.a.slug}/signin/${other.loginId}/verify`;
  expect((await http.request(path, { body: { code } })).status).toBe(200);
  expect((await http.request(path, { body: { code } })).status).toBe(410);
  // A login belongs to the shop it started at.
  const elsewhere = `/shop/${world.b.slug}/signin/${other.loginId}/resend`;
  expect((await http.request(elsewhere, { method: "POST" })).status).toBe(404);
});

test("a failed Turnstile check stores and sends nothing", async () => {
  const before = world.sent.length;
  const refused = await start(world.a.slug, "0243003000", freshIp(), "bot");
  expect(refused.status).toBe(403);
  expect(world.sent.length).toBe(before);
  const rows = await world.db
    .select()
    .from(schema.shopLogin)
    .where(eq(schema.shopLogin.phone, "0243003000"));
  expect(rows).toEqual([]);
});

test("one address may ask for ten codes a minute, and one phone for five an hour, whatever the address", async () => {
  const ip = "198.51.100.200";
  const answers = [];
  for (let i = 0; i < 11; i++)
    answers.push((await start(world.b.slug, `02430040${10 + i}`, ip)).status);
  expect(answers).toEqual([...Array(10).fill(202), 429]);
  expect((await start(world.b.slug, "0243004099", ip)).headers.get("retry-after")).toBe("60");
  const phone = [];
  for (let i = 0; i < 6; i++) phone.push((await start(world.b.slug, "0243005000")).status);
  expect(phone).toEqual([202, 202, 202, 202, 202, 429]);
});

test("a write from another site is refused, and a forged or missing cookie is 401", async () => {
  const cross = await http.request(`/shop/${world.a.slug}/signin`, {
    body: { phone: "0243006000" },
    origin: "https://evil.test",
  });
  expect(cross.status).toBe(403);
  expect((await http.request("/shop/account")).status).toBe(401);
  const forged = `shopper_shop=${"A".repeat(43)}`;
  expect((await http.request("/shop/account", { cookie: forged })).status).toBe(401);
});

test("a box serving one shop knows no other shop code", async () => {
  const box = shopHttp(world, { orgId: world.a.orgId });
  expect((await box.request(`/shop/${world.b.slug}`)).status).toBe(404);
  expect(
    (await box.request(`/shop/${world.b.slug}/signin`, { body: { phone: "0243007000" } })).status,
  ).toBe(404);
  expect((await box.request(`/shop/${world.a.slug}`)).status).toBe(200);
  box.close();
});

test("a payment code spends the payment budget: one address gets five a minute", async () => {
  const ip = "198.51.100.201";
  const answers = [];
  for (let i = 0; i < 6; i++)
    answers.push(
      (
        await http.request(`/shop/${world.b.slug}/orders/${crypto.randomUUID()}/pay/code`, {
          body: { key: "guess", otp: "123456" },
          ip,
        })
      ).status,
    );
  expect(answers.slice(0, 5)).not.toContain(429);
  expect(answers[5]).toBe(429);
});
