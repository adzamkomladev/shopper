// Day 42: an archive imported into an empty database is the same business. Every row keeps its id and its codes; the
// store sequence, the registers' receipt numbers and the audit chain carry on from where the box stopped; the
// credentials sent with a move land; a file that is not the signed one writes nothing; and a second run is a no-op.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq, sql } from "drizzle-orm";
import { verifyChain } from "@shopper/audit";
import { buildInfo } from "@shopper/config";
import { allocateStoreSequence } from "@shopper/core";
import { postEntry } from "@shopper/core/ledger";
import { issueReceiptBlocks } from "@shopper/core/till";
import * as schema from "@shopper/db-pg";
import { describeFile, HIDDEN_COLUMNS, importArchive, type Manifest } from "@shopper/export";
import { money } from "@shopper/money";
import { SECRETS, storeAsset } from "../../support/export/org";
import { movedArchive, emptyDatabase } from "../../support/migration/archive";

type Moved = Awaited<ReturnType<typeof movedArchive>>;
let a: Moved;
let b: Awaited<ReturnType<typeof emptyDatabase>>;
const opened: { close: () => Promise<void> }[] = [];

beforeAll(async () => {
  a = await movedArchive(async (f, blobs) => {
    await storeAsset(f.db, blobs, f.ctx.orgId, {
      key: "products/rice.png",
      purpose: "product_image",
    });
    await f.db
      .insert(schema.category)
      .values(["Grains", "Oils", "Drinks", "Snacks"].map((name) => ({ orgId: f.ctx.orgId, name })));
    const [register] = await f.db
      .select()
      .from(schema.device)
      .where(eq(schema.device.id, f.sale.deviceId));
    // Two blocks issued and a few numbers used, as a trading register has.
    await issueReceiptBlocks(
      f.db,
      { orgId: f.ctx.orgId, deviceId: register!.id, branchId: register!.branchId } as never,
      7,
      f.ctx.appVersion,
    );
    await f.db.transaction((tx) =>
      postEntry(tx, f.ctx, {
        source: "sale",
        sourceId: f.sale.localId,
        occurredAt: new Date("2026-11-14T10:00:00Z"),
        memo: "Sale 0001",
        lines: [
          { account: "cash_drawer", amount: money(12_000) },
          { account: "sales", amount: money(-10_000) },
          { account: "vat", amount: money(-2_000) },
        ],
      }),
    );
    // The pending sale is numbered above the store's counter, as a restored box can leave it.
    await f.db
      .update(schema.sale)
      .set({ storeSequence: 9223372036854775005n })
      .where(eq(schema.sale.localId, f.sale.localId));
  });
  opened.push(a);
  b = await emptyDatabase();
  opened.push(b);
  await importArchive(b.db, a.context, {
    manifest: a.manifest,
    read: a.read,
    blobs: b.blobs,
    credentials: {
      passwords: [{ userId: a.f.userId, password: SECRETS.password }],
      pins: [{ userId: a.f.userId, pinHash: SECRETS.pin }],
      sessionKey: SECRETS.sessionKey,
    },
  });
});
afterAll(async () => {
  for (const each of opened.reverse()) await each.close();
});

/** Every row of a table in the org, as Postgres' own JSON text, secrets and the move's own counters left out. */
async function rows(db: schema.ShopperDatabase, table: string, ids?: string[]) {
  // The floors raise a store's counter (and so its updated_at) when a sale is numbered above it, by design.
  const hidden = [
    ...(HIDDEN_COLUMNS[table] ?? []),
    "last_seq",
    "receipt_last",
    ...(table === "store" ? ["updated_at"] : []),
  ];
  const { rows: found } = await db.execute<{ line: string }>(sql`
    select (to_jsonb(t) - ${sql`ARRAY[${sql.join(
      hidden.map((c) => sql`${c}`),
      sql`, `,
    )}]::text[]`})::text as line
    from ${sql.identifier(table)} t where org_id = ${a.context.orgId}
    ${
      ids
        ? sql`and id::text in (${sql.join(
            [...ids, ""].map((id) => sql`${id}`),
            sql`, `,
          )})`
        : sql``
    }
    order by id`);
  return found.map((row) => row.line);
}

test("every table arrives row for row with the same ids and codes, and nothing of the other shop", async () => {
  const tables = Object.keys(a.manifest.tables);
  expect(tables).toEqual(
    expect.arrayContaining(["org", "sale", "device", "branch", "journal_line"]),
  );
  for (const table of tables) {
    const before = await rows(a.f.db, table);
    const ids = before.map((line) => (JSON.parse(line) as { id: string }).id);
    expect({ table, rows: await rows(b.db, table, ids) }).toEqual({ table, rows: before });
  }
  const orgs = await b.db.select({ id: schema.org.id }).from(schema.org);
  expect(orgs).toEqual([{ id: a.context.orgId }]);
  expect(await b.blobs.get(a.context.orgId, "products/rice.png")).toEqual(
    await a.blobs.get(a.context.orgId, "products/rice.png"),
  );
});

test("the store sequence, receipt numbers and ledger carry on where the box stopped", async () => {
  const next = await b.db.transaction((tx) =>
    allocateStoreSequence(tx, a.context.orgId, a.f.store.id),
  );
  expect(next).toBe(9223372036854775006n);
  // The cloud hands a register the same blocks the box would have.
  const [register] = await b.db
    .select()
    .from(schema.device)
    .where(eq(schema.device.id, a.f.sale.deviceId));
  const principal = {
    orgId: a.context.orgId,
    deviceId: register!.id,
    branchId: register!.branchId,
  } as never;
  const fromBox = await issueReceiptBlocks(a.f.db, principal, 1500, a.context.appVersion);
  const fromCloud = await issueReceiptBlocks(b.db, principal, 1500, a.context.appVersion);
  expect(fromCloud).toEqual(fromBox);
  expect(fromCloud.blocks[0]!.start).toBe(1001);
  const accounts = (db: schema.ShopperDatabase) =>
    db.$count(schema.ledgerAccount, eq(schema.ledgerAccount.orgId, a.context.orgId));
  expect(await accounts(b.db)).toBe(await accounts(a.f.db));
});

test("the credentials sent with the move land, and the audit chain continues with the import", async () => {
  const [password] = await b.db
    .select({ password: schema.account.password })
    .from(schema.account)
    .where(and(eq(schema.account.orgId, a.context.orgId), eq(schema.account.userId, a.f.userId)));
  expect(password!.password).toBe(SECRETS.password);
  const [pin] = await b.db.select().from(schema.cashierPin);
  expect(pin!.pinHash).toBe(SECRETS.pin);
  const [key] = await b.db.select().from(schema.sessionKey);
  expect(key!.key).toBe(SECRETS.sessionKey);

  const chain = await b.db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, a.context.orgId))
    .orderBy(schema.auditLog.chainSeq);
  expect(await verifyChain(chain)).toMatchObject({ valid: true, count: chain.length });
  const imports = chain.filter((entry) => entry.command === "migration.import");
  expect(imports).toHaveLength(1);
  expect(JSON.stringify(imports[0]!.payload)).not.toContain(SECRETS.password);
});

test("a second import changes nothing", async () => {
  const audits = () => b.db.$count(schema.auditLog, eq(schema.auditLog.orgId, a.context.orgId));
  const before = await audits();
  const again = await importArchive(b.db, a.context, {
    manifest: a.manifest,
    read: a.read,
    blobs: b.blobs,
  });
  expect(again).toEqual({ imported: false, rows: 0, files: 0 });
  expect(await audits()).toBe(before);
});

test("a file that is not the signed one, or a newer schema, is refused and writes nothing", async () => {
  const c = await emptyDatabase();
  opened.push(c);
  const flipped = async (path: string) => {
    const bytes = await a.read(path);
    if (!bytes || !path.startsWith("tables/sale/")) return bytes;
    const copy = bytes.slice();
    copy[5] ^= 1;
    return copy;
  };
  await expect(
    importArchive(c.db, a.context, { manifest: a.manifest, read: flipped, blobs: c.blobs }),
  ).rejects.toThrow("tables/sale/0001.ndjson is not the file the archive signed.");
  const newer = { ...a.manifest, schema_version: buildInfo.schemaVersion + 1 };
  await expect(
    importArchive(c.db, a.context, { manifest: newer, read: a.read, blobs: c.blobs }),
  ).rejects.toThrow(/made by a newer Shopper/);
  expect(await c.db.$count(schema.org)).toBe(0);
  expect(await c.db.$count(schema.auditLog)).toBe(0);
});

test("an archive from before a column existed imports with that column's default", async () => {
  const d = await emptyDatabase();
  opened.push(d);
  const path = a.manifest.tables.category!.files[0]!.path;
  const older = new TextEncoder().encode(
    new TextDecoder()
      .decode((await a.read(path))!)
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const { updated_at: _dropped, ...rest } = JSON.parse(line) as Record<string, unknown>;
        return `${JSON.stringify(rest)}\n`;
      })
      .join(""),
  );
  const described = await describeFile(path, older);
  const manifest: Manifest = structuredClone(a.manifest);
  manifest.tables.category!.files[0] = {
    path,
    bytes: described.bytes,
    sha256: described.sha256,
    rows: described.rows,
  };
  await importArchive(d.db, a.context, {
    manifest,
    read: async (wanted) => (wanted === path ? older : a.read(wanted)),
    blobs: d.blobs,
  });
  const categories = await d.db.select().from(schema.category);
  expect(categories.length).toBe(a.manifest.tables.category!.rows);
  expect(categories.every((category) => category.updatedAt instanceof Date)).toBe(true);
});
