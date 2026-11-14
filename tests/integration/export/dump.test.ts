// The archive's tables: one consistent snapshot of every row the org owns, nothing another org owns, and no credential.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { boxBlobs } from "@shopper/adapters-box";
import * as schema from "@shopper/db-pg";
import { dumpOrg } from "@shopper/export";
import { exportFixture, SECRETS, storeAsset } from "../../support/export/org";

type Fixture = Awaited<ReturnType<typeof exportFixture>>;
let f: Fixture;
let dir: string;
let blobs: Awaited<ReturnType<typeof boxBlobs>>["blobs"];
let dump: Awaited<ReturnType<typeof dumpOrg>>;
let bytes: Map<string, Uint8Array>;
let concurrentCategories = 0;

beforeAll(async () => {
  f = await exportFixture();
  dir = await mkdtemp(join(tmpdir(), "shopper-dump-"));
  blobs = (await boxBlobs(dir, { baseUrl: "http://127.0.0.1", secret: new Uint8Array(32).fill(3) }))
    .blobs;
  await storeAsset(f.db, blobs, f.ctx.orgId, {
    key: "products/rice.png",
    purpose: "product_image",
  });
  await storeAsset(f.db, blobs, f.ctx.orgId, { key: "kyb/licence.png", purpose: "kyb_document" });
  await storeAsset(f.db, blobs, f.ctx.orgId, {
    key: "products/gone.png",
    purpose: "product_image",
    stored: false,
  });
  await storeAsset(f.db, blobs, f.ctx.orgId, {
    key: "products/swapped.png",
    purpose: "product_image",
    swapped: true,
  });
  await storeAsset(f.db, blobs, f.other.orgId, {
    key: "products/theirs.png",
    purpose: "product_image",
  });
  dump = await dumpOrg(f.db, {
    orgId: f.ctx.orgId,
    blobs,
    prefix: "exports/test",
    // Three rows a file, so every table with more than three rows crosses a page.
    pageRows: 3,
    // After the first table is read the shop keeps trading: a later table must not see it.
    afterTable: async (table) => {
      if (concurrentCategories++ > 0) return;
      await f.db
        .insert(schema.category)
        .values({ orgId: f.ctx.orgId, name: `Added after ${table}` });
    },
  });
  bytes = new Map(
    await Promise.all(
      dump.files.map(
        async (file) => [file.path, (await blobs.get(f.ctx.orgId, file.key))!] as const,
      ),
    ),
  );
});
afterAll(async () => {
  await f?.close();
  if (dir) await rm(dir, { recursive: true, force: true });
});

const lines = (path: string) =>
  new TextDecoder().decode(bytes.get(path)).split("\n").filter(Boolean);
const tableRows = (table: string) =>
  dump.files
    .filter((file) => file.path.startsWith(`tables/${table}/`))
    .flatMap((file) => lines(file.path).map((line) => JSON.parse(line) as Record<string, unknown>));

test("every table's rows are in the dump once, in id order, across pages", async () => {
  const tables = [
    ...new Set(dump.files.flatMap((file) => /^tables\/([^/]+)\//.exec(file.path)?.[1] ?? [])),
  ];
  expect(tables.length).toBeGreaterThan(10);
  for (const table of tables) {
    const rows = tableRows(table);
    const ids = rows.map((row) => String(row.id));
    expect(ids, table).toEqual([...ids].sort());
    expect(new Set(ids).size, table).toBe(ids.length);
    // The category that arrived mid-dump is the only row the snapshot may lack.
    expect(rows.length, table).toBe((await f.count(table)) - (table === "category" ? 1 : 0));
  }
  // A page holds at most three rows, and the sale path wrote more than three lines somewhere.
  expect(dump.files.some((file) => file.path.endsWith("/0002.ndjson"))).toBe(true);
  for (const file of dump.files.filter((file) => file.path.endsWith(".ndjson")))
    expect(file.rows).toBeLessThanOrEqual(3);
});

test("the dump is a snapshot: a row added while it runs is in no table", async () => {
  expect(concurrentCategories).toBeGreaterThan(1);
  const names = tableRows("category").map((row) => row.name);
  expect(names.some((name) => String(name).startsWith("Added after"))).toBe(false);
  expect(await f.count("category")).toBe(names.length + 1);
});

test("nothing another org owns is in it, and every row names this org", async () => {
  const all = [...bytes.values()].map((value) => new TextDecoder().decode(value)).join("\n");
  for (const foreign of [f.other.orgId, f.otherStore.id, "Other Mart", "Elsewhere"])
    expect(all).not.toContain(foreign);
  for (const table of ["sale", "store", "product", "audit_log"])
    for (const row of tableRows(table)) expect(row.org_id).toBe(f.ctx.orgId);
});

test("no credential leaves: not a hash, a token, a session or the session key", async () => {
  const all = [...bytes.values()].map((value) => new TextDecoder().decode(value)).join("\n");
  for (const secret of Object.values(SECRETS)) expect(all).not.toContain(secret);
  const paths = dump.files.map((file) => file.path).join("\n");
  for (const table of ["session", "session_key", "cashier_pin", "verification"])
    expect(paths).not.toContain(`tables/${table}/`);
  // Sales name the cashier session they were made in, so sessions move - without the token that opens them.
  for (const session of tableRows("cashier_session"))
    expect(session).not.toHaveProperty("token_hash");
  expect(tableRows("cashier_session").length).toBeGreaterThan(0);
  // The account is still there (so a person can be re-created), without its secrets.
  const account = tableRows("account")[0]!;
  expect(account.account_id).toBe("ama");
  for (const column of ["password", "refresh_token", "access_token", "id_token"])
    expect(account).not.toHaveProperty(column);
});

test("a 64-bit counter and money survive as the exact digits", async () => {
  expect(new TextDecoder().decode(bytes.get(`tables/store/0001.ndjson`))).toMatch(
    /"last_seq": 9223372036854775000\b/,
  );
});

test("blobs the rows point at come along, others do not, and a missing or swapped one is reported", async () => {
  expect(
    dump.files.filter((file) => file.path.startsWith("blobs/")).map((file) => file.path),
  ).toEqual(["blobs/kyb/licence.png", "blobs/products/rice.png"]);
  // A file whose bytes are not the ones its row registered is never signed as if it were: it is left out and named.
  expect(dump.missingBlobs).toEqual(["products/gone.png", "products/swapped.png"]);
});
