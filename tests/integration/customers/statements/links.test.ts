// A customer opens their statement from a signed link with no session. A tampered, expired, revoked or
// cross-org token is a bare 404; the page shows only that customer and that period; every open is counted.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import { boxCache, boxRateLimiter } from "@shopper/adapters-box";
import { boxRenderer } from "@shopper/adapters-box/renderer";
import { createApi } from "@shopper/api";
import { serveRuntime } from "@shopper/api/runtime";
import { signStatementToken } from "@shopper/core/customers";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { ids } from "../../../support/till/sales";
import { databases } from "../../../support/till/server";
import {
  baseURL,
  linkSecret,
  portalMember,
  portalOwner,
  secret,
  type Portal,
} from "../../../support/api/portal";
import { addCustomer } from "../../../support/customers/seed";
import { addEntryAt, auditCommands } from "../../../support/customers/ledger";
import { linkRow, publicRead, statementApi } from "../../../support/customers/statements";

// A still clock: the budget is spent by count, not by how fast a loaded machine sends 60 requests.
const rateLimiter = boxRateLimiter(() => 0);

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let admin: ReturnType<typeof statementApi>;
let cashier: ReturnType<typeof statementApi>;
const period = { from: "2026-10-01", to: "2026-10-31" };

/** A customer with entries before, inside and after the period; the link is for October only. */
async function seeded(phone: string) {
  const customerId = await addCustomer({ name: "Kofi Boateng", phone, creditLimit: 1_000_000 });
  await addEntryAt(customerId, "charge", 400_000, "2026-09-20T09:00:00Z");
  await addEntryAt(customerId, "charge", 200_000, "2026-10-05T09:00:00Z");
  await addEntryAt(customerId, "payment", -100_000, "2026-10-12T09:00:00Z");
  await addEntryAt(customerId, "charge", 999_000, "2026-11-04T09:00:00Z");
  return customerId;
}
async function linked(phone: string) {
  const customerId = await seeded(phone);
  const link = await admin.link(customerId, period);
  expect(link.status).toBe(201);
  return { customerId, ...(link.body as { id: string; token: string; url: string }) };
}
const notFound = async (token: string) => {
  const read = await publicRead(owner, token);
  expect(read.json.status, token).toBe(404);
  expect(read.json.text).toBe("");
  expect(read.pdf.status, token).toBe(404);
  expect(read.pdf.bytes).toHaveLength(0);
};

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  admin = statementApi(owner, owner.cookie);
  cashier = statementApi(owner, await portalMember(owner, "cashier"));
});
afterAll(async () => world?.local.close());

test("a link opens the statement JSON and PDF with no session, for that customer and period only", async () => {
  const { customerId, token, url, id } = await linked("0271740001");
  expect(url).toBe(`${baseURL}/statement/${token}`);
  const other = await seeded("0271740002");

  const read = await publicRead(owner, token);
  expect(read.json.status).toBe(200);
  const statement = JSON.parse(read.json.text);
  expect(statement).toMatchObject({
    customer: { name: "Kofi Boateng" },
    period,
    opening: 400_000,
    closing: 500_000,
  });
  expect(statement.shop.name).toEqual(expect.any(String));
  expect(statement.entries.map((e: any) => [e.kind, e.amount, e.balance])).toEqual([
    ["charge", 200_000, 600_000],
    ["payment", -100_000, 500_000],
  ]);
  // Nothing that identifies the ledger or another customer leaves the server.
  expect(read.json.text).not.toContain(customerId);
  expect(read.json.text).not.toContain(other);
  expect(read.pdf.status).toBe(200);
  expect(read.pdf.type).toBe("application/pdf");
  expect(Buffer.from(read.pdf.bytes.subarray(0, 5)).toString("latin1")).toBe("%PDF-");

  const listed = await admin.links(customerId);
  expect(listed.body).toMatchObject([{ id, from: period.from, to: period.to, revokedAt: null }]);
  expect(JSON.stringify(listed.body)).not.toContain(token);
});

test("every open is counted on the link row, and is not an audit command", async () => {
  const { id, token, customerId } = await linked("0271740003");
  expect(await linkRow(id)).toMatchObject({ view_count: 0, viewed_at: null });
  await publicRead(owner, token);
  await publicRead(owner, token);
  const row = await linkRow(id);
  expect(row.view_count).toBe(4);
  expect(row.viewed_at).not.toBeNull();
  expect((await auditCommands(customerId)).filter((c) => /view/.test(c))).toEqual([]);
  expect((await admin.links(customerId)).body[0]).toMatchObject({ viewCount: 4 });
});

test("a tampered, expired, revoked or cross-org token is a bare 404 and counts no view", async () => {
  const { id, token, customerId } = await linked("0271740004");
  const [payload, signature] = token.split(".") as [string, string];
  const flipped = signature.replace(/.$/, (c) => (c === "0" ? "1" : "0"));
  await notFound(`${payload}.${flipped}`);
  await notFound(`${payload}x.${signature}`);
  await notFound("not-a-token");

  // Properly signed, but naming another org's tenant for this org's link.
  const link = await linkRow(id);
  const forged = await signStatementToken(linkSecret, {
    linkId: id,
    orgId: ids.otherOrg,
    customerId,
    ...period,
    exp: new Date(link.expires_at).getTime() + 60_000,
  });
  await notFound(forged);
  // ...or an expiry in the past, however well signed.
  await notFound(
    await signStatementToken(linkSecret, {
      linkId: id,
      orgId: ids.org,
      customerId,
      ...period,
      exp: Date.now() - 1_000,
    }),
  );
  expect((await linkRow(id)).view_count).toBe(0);

  await databases().db.execute(
    sql`UPDATE statement_link SET expires_at = now() - interval '1 second' WHERE id = ${id}`,
  );
  await notFound(token);

  const second = await linked("0271740005");
  expect((await publicRead(owner, second.token)).json.status).toBe(200);
  expect((await admin.revoke(second.customerId, second.id)).status).toBe(200);
  await notFound(second.token);
  expect((await admin.revoke(second.customerId, second.id)).status).toBe(200);
  expect(await auditCommands(second.customerId)).toContain("statement.link.revoke");
});

test("links need customer.manage; reading them needs customer.read; a foreign customer or link is 404", async () => {
  const customerId = await seeded("0271740006");
  expect((await cashier.link(customerId, period)).status).toBe(403);
  const { id } = (await admin.link(customerId, period)).body;
  expect((await cashier.links(customerId)).status).toBe(200);
  expect((await cashier.revoke(customerId, id)).status).toBe(403);

  for (const bad of [
    { from: "soon", to: "2026-10-31" },
    { from: "2026-10-31", to: "2026-10-01" },
  ])
    expect((await admin.link(customerId, bad)).status).toBe(400);
  const foreign = await addCustomer({ orgId: ids.otherOrg });
  expect((await admin.link(foreign, period)).status).toBe(404);
  expect((await admin.revoke(customerId, v7())).status).toBe(404);
  expect((await admin.revoke(foreign, id)).status).toBe(404);
  expect((await linkRow(id)).revoked_at).toBeNull();
});

test("a period is at most 366 days: a longer link, send or statement is 400 and a year still works", async () => {
  const customerId = await seeded("0271740008");
  const long = { from: "2025-09-01", to: "2026-10-05" };
  expect((await admin.link(customerId, long)).status).toBe(400);
  expect((await admin.send(customerId, { channel: "sms", ...long })).status).toBe(400);
  const query = (q: string) =>
    owner.api.request(`/customers/${customerId}/statement?${q}`, {
      headers: { cookie: owner.cookie },
    });
  expect((await query(`from=${long.from}&to=${long.to}`)).status).toBe(400);
  expect((await query("from=2026-10-01&to=2027-10-01")).status).toBe(200);
  expect((await admin.link(customerId, { from: "2026-10-01", to: "2027-10-01" })).status).toBe(201);
});

test("a PDF the renderer cannot make is a 503 and counts no view", async () => {
  const { id, token } = await linked("0271740009");
  const bare = createApi({
    database: databases().db,
    authentication: owner.auth,
    linkSecret,
    baseURL,
  });
  expect((await bare.request(`/public/statements/${token}/pdf`)).status).toBe(503);
  expect((await linkRow(id)).view_count).toBe(0);
});

test("a link secret under 32 characters signs no statement token", async () => {
  const payload = {
    linkId: v7(),
    orgId: ids.org,
    customerId: v7(),
    ...period,
    exp: Date.now() + 60_000,
  };
  await expect(signStatementToken("too short", payload)).rejects.toThrow(/at least 32/);
});

test("the runtime serves the public route without a session and rate-limits it", async () => {
  const { token } = await linked("0271740007");
  const cache = boxCache(":memory:");
  const request = (path: string, clientIP: string) =>
    serveRuntime(new Request(`${baseURL}${path}`), {
      database: databases().db,
      cache: cache.cache,
      rateLimiter,
      secret,
      baseURL,
      linkSecret,
      renderer: boxRenderer(),
      clientIP,
    });
  expect((await request(`/public/statements/${token}`, "203.0.113.7")).status).toBe(200);
  expect((await request(`/public/statements/${token}/pdf`, "203.0.113.7")).status).toBe(200);
  const statuses = new Set<number>();
  for (let i = 0; i < 60; i++)
    statuses.add((await request(`/public/statements/${token}`, "203.0.113.8")).status);
  expect(statuses).toEqual(new Set([200, 429]));
});
