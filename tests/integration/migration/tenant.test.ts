// Day 42: a licensed box signs its own manifest, so a crafted archive is self-consistent. Only the import can stop it
// from planting rows in another shop that is already in the cloud.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { describeFile, importArchive, type Manifest } from "@shopper/export";
import { emptyDatabase, movedArchive } from "../../support/migration/archive";

let a: Awaited<ReturnType<typeof movedArchive>>;
let e: Awaited<ReturnType<typeof emptyDatabase>>;

beforeAll(async () => {
  a = await movedArchive(async (f) => {
    await f.db.insert(schema.category).values({ orgId: f.ctx.orgId, name: "Grains" });
  });
  e = await emptyDatabase();
});
afterAll(async () => {
  await e?.close();
  await a?.close();
});

/** The archive with one more line in a table's first part, re-described as a box would sign it. */
function planted(table: string, line: (row: Record<string, unknown>) => object) {
  return async () => {
    const path = a.manifest.tables[table]!.files[0]!.path;
    const text = new TextDecoder().decode((await a.read(path))!);
    const first = JSON.parse(text.split("\n")[0]!) as Record<string, unknown>;
    const bytes = new TextEncoder().encode(`${text}${JSON.stringify(line(first))}\n`);
    const described = await describeFile(path, bytes);
    const manifest: Manifest = structuredClone(a.manifest);
    manifest.tables[table]!.files[0] = {
      path,
      bytes: described.bytes,
      sha256: described.sha256,
      rows: described.rows,
    };
    return importArchive(e.db, a.context, {
      manifest,
      read: async (at) => (at === path ? bytes : a.read(at)),
      blobs: e.blobs,
    });
  };
}

test("an archive carrying rows of another shop is refused and writes nothing", async () => {
  const victim = v7();
  await e.db.insert(schema.org).values({ id: victim, name: "Victim Mart", slug: "victim-mart" });
  await expect(
    planted("category", (row) => ({ ...row, id: v7(), org_id: victim }))(),
  ).rejects.toThrow("This archive holds records of another shop.");
  await expect(
    planted("org", (row) => ({ ...row, id: v7(), slug: "second-mart" }))(),
  ).rejects.toThrow("This archive holds records of another shop.");
  expect(await e.db.$count(schema.org)).toBe(1);
  expect(await e.db.$count(schema.category)).toBe(0);
});
