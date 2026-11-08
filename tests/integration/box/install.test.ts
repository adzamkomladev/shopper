// First boot: a box with no shop creates one from its setup code (shop, first store, owner, licence), once.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { createBoxApp } from "@shopper/box";
import { generateKey, issueLicence } from "@shopper/core/licence";
import { sha256 } from "@shopper/utils";
import { v7 } from "uuid";
import { postgresFixture } from "../../fixtures/postgres";

const CODE = "K7M2-Q9XP-4HWR";
let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let dir: string;
let issuer: Awaited<ReturnType<typeof generateKey>>;
let box: ReturnType<typeof createBoxApp>;
let machine: string;
let boxKey: string;

const owner = {
  name: "Esi Mensah",
  email: "esi@example.com",
  password: "a long enough passphrase",
};
const body = (extra: Record<string, unknown> = {}) => ({
  code: CODE,
  shop: { name: "Esi Mart", code: "esi-mart" },
  store: { name: "Osu" },
  owner,
  ...extra,
});
const post = (data: unknown) =>
  box.fetch(
    new Request("http://box.test/install", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    }),
  );
const state = async () =>
  (await box.fetch(new Request("http://box.test/install"))).json() as Promise<{
    needsInstall: boolean;
    licence: { enforced: boolean; request?: string };
  }>;
const count = async (table: string) =>
  (await pool.query(`select count(*)::int as n from ${table}`)).rows[0].n as number;
async function licenceFor(forMachine: string, key = boxKey) {
  return issueLicence(issuer.privateKey, {
    id: v7(),
    org: v7(),
    site: "Osu",
    machine: forMachine,
    key,
    terminals: 5,
    issuedAt: new Date().toISOString(),
    maintenanceUntil: "2027-11-01",
  });
}

beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  await migrateDatabase(drizzle(pool, { schema }));
  dir = await mkdtemp(join(tmpdir(), "box-install-"));
  await writeFile(join(dir, "machine-id"), "0123456789abcdef0123456789abcdef\n");
  machine = await sha256("0123456789abcdef0123456789abcdef");
  issuer = await generateKey();
  box = createBoxApp(
    {
      DATABASE_URL: fixture.connectionString,
      SHOPPER_AUTH_SECRET: "install-test-secret-0123456789abcdef",
      SHOPPER_AUTH_URL: "http://box.test",
      SHOPPER_SINGLE_SHOP: "1",
      SHOPPER_SETUP_CODE_HASH: await sha256(CODE.replaceAll("-", "")),
      SHOPPER_LICENCE_DIR: join(dir, "licence"),
      SHOPPER_MACHINE_ID_FILE: join(dir, "machine-id"),
    },
    { licenceIssuer: issuer.publicKey },
  );
  // The box makes its own key the first time it is asked; the request code carries its public half.
  const request = (await state()).licence.request!;
  boxKey = JSON.parse(Buffer.from(request, "base64url").toString("utf8")).key;
}, 120_000);
afterAll(async () => {
  await pool?.end();
  await fixture?.close();
  if (dir) await rm(dir, { recursive: true, force: true });
});

test("an empty box says it needs installing and offers the request code a licence is issued from", async () => {
  const empty = await state();
  expect(empty.needsInstall).toBe(true);
  expect(empty.licence.enforced).toBe(true);
  expect(
    JSON.parse(Buffer.from(empty.licence.request!, "base64url").toString("utf8")),
  ).toMatchObject({
    machine,
  });
});

test("a wrong code, a licence for another machine and a weak password create nothing", async () => {
  expect((await post(body({ code: "AAAA-BBBB-CCCC" }))).status).toBe(403);
  const other = await post(body({ licence: await licenceFor("f".repeat(64)) }));
  expect(other.status).toBe(422);
  expect(((await other.json()) as { error: string }).error).toMatch(/another machine/i);
  expect((await post(body({ owner: { ...owner, password: "short" } }))).status).toBe(400);
  // Issued for an earlier key of this machine: genuine and for this machine, but it could never check in.
  const earlier = await post(
    body({ licence: await licenceFor(machine, (await generateKey()).publicKey) }),
  );
  expect(earlier.status).toBe(422);
  expect(((await earlier.json()) as { error: string }).error).toMatch(/request code/i);
  // No licence at all is refused where a licence is enforced.
  expect((await post(body())).status).toBe(422);
  expect(await count("org")).toBe(0);
  expect(await count('"user"')).toBe(0);
});

test("the right code creates the shop, its first store and its owner in one audited step, once", async () => {
  const licence = await licenceFor(machine);
  const responses = await Promise.all([post(body({ licence })), post(body({ licence }))]);
  // Two people pressing the button at once make one shop.
  expect(responses.map((response) => response.status).sort()).toEqual([201, 404]);
  expect(await count("org")).toBe(1);
  expect(await count("store")).toBe(1);
  const { rows } = await pool.query("select command from audit_log order by chain_seq");
  expect(rows.map((row) => row.command)).toEqual(
    expect.arrayContaining([
      "org.provision",
      "auth.owner.create",
      "management.mutate",
      "box.install",
    ]),
  );
  expect(JSON.parse(await readFile(join(dir, "licence", "licence.json"), "utf8")).machine).toBe(
    machine,
  );
  expect((await box.fetch(new Request("http://box.test/install"))).status).toBe(404);
  expect((await post(body({ licence }))).status).toBe(404);

  // The owner signs in to the one shop this box now is, without choosing a tenant.
  const signIn = await box.fetch(
    new Request("http://box.test/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://box.test" },
      body: JSON.stringify({ email: owner.email, password: owner.password }),
    }),
  );
  expect(signIn.status).toBe(200);
});

test("the wrong-code limiter stops guessing", async () => {
  // Five wrong codes in a row, then even the right one waits.
  const fresh = await postgresFixture();
  try {
    const empty = new Pool({ connectionString: fresh.connectionString });
    await migrateDatabase(drizzle(empty, { schema }));
    await empty.end();
    const guarded = createBoxApp(
      {
        DATABASE_URL: fresh.connectionString,
        SHOPPER_AUTH_SECRET: "install-test-secret-0123456789abcdef",
        SHOPPER_AUTH_URL: "http://box.test",
        SHOPPER_SETUP_CODE_HASH: await sha256(CODE.replaceAll("-", "")),
      },
      {},
    );
    const attempt = (code: string) =>
      guarded.fetch(
        new Request("http://box.test/install", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body({ code })),
        }),
      );
    for (let guess = 0; guess < 5; guess += 1)
      expect((await attempt("ZZZZ-ZZZZ-ZZZZ")).status).toBe(403);
    expect((await attempt(CODE)).status).toBe(429);
  } finally {
    await fresh.close();
  }
}, 120_000);
