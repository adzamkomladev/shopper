import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shopper/db-pg";
import { sha256 } from "@shopper/utils";
import type { Blobs } from "@shopper/ports";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { postgresFixture } from "../../fixtures/postgres";
import { provisionPendingSale } from "../till/pending/sale";

/** Text that must never reach an archive: planted in every kind of credential the database holds. */
export const SECRETS = {
  password: "scrypt$SECRET-PASSWORD-HASH",
  refresh: "SECRET-REFRESH-TOKEN",
  session: "SECRET-SESSION-TOKEN",
  pin: "SECRET-PIN-HASH",
  sessionKey: "SECRET-SESSION-KEY",
};

/** A migrated database holding one fully seeded org (`ctx`) and a second one that must never leak into its dump. */
export async function exportFixture() {
  const fixture = await postgresFixture();
  const pool = new Pool({ connectionString: fixture.connectionString });
  const db = drizzle(pool, { schema });
  await migrateDatabase(db);
  const ctx = provisioningContext();
  const other = provisioningContext();
  await provisionOrg(db, ctx, { name: "Kofi Mart", slug: "kofi-mart" });
  await provisionOrg(db, other, { name: "Other Mart", slug: "other-mart" });
  const [store] = await db
    .insert(schema.store)
    .values({ orgId: ctx.orgId, name: "Main" })
    .returning();
  const [otherStore] = await db
    .insert(schema.store)
    .values({ orgId: other.orgId, name: "Elsewhere" })
    .returning();
  const sale = await provisionPendingSale(db, ctx, store!.id, other.orgId, ctx.appVersion);
  await provisionPendingSale(db, other, otherStore!.id, ctx.orgId, other.appVersion);
  await db
    .update(schema.store)
    .set({ lastSeq: 9223372036854775000n })
    .where(eq(schema.store.id, store!.id));
  const userId = await plantSecrets(db, ctx.orgId);
  return {
    db,
    userId,
    ctx,
    other,
    store: store!,
    otherStore: otherStore!,
    sale,
    count: async (table: string, orgId = ctx.orgId) =>
      Number(
        (
          await db.execute(
            sql`select count(*)::int as n from ${sql.identifier(table)} where org_id = ${orgId}`,
          )
        ).rows[0]!.n,
      ),
    close: async () => {
      await pool.end();
      await fixture.close();
    },
  };
}

async function plantSecrets(db: schema.ShopperDatabase, orgId: string) {
  const [user] = await db
    .insert(schema.user)
    .values({ orgId, email: "cashier@kofi.test", name: "Ama" })
    .returning();
  await db.insert(schema.account).values({
    orgId,
    accountId: "ama",
    providerId: "credential",
    userId: user!.id,
    password: SECRETS.password,
    refreshToken: SECRETS.refresh,
  });
  await db.insert(schema.session).values({
    orgId,
    userId: user!.id,
    token: SECRETS.session,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  await db.insert(schema.cashierPin).values({ orgId, userId: user!.id, pinHash: SECRETS.pin });
  await db.insert(schema.sessionKey).values({ orgId, key: SECRETS.sessionKey });
  return user!.id;
}

/** A product image the org's `asset` row points at, stored for real. */
export async function storeAsset(
  db: schema.ShopperDatabase,
  blobs: Blobs,
  orgId: string,
  asset: {
    key: string;
    purpose: "product_image" | "kyb_document";
    stored?: boolean;
    /** Stores other bytes than the ones the row registered. */
    swapped?: boolean;
  },
) {
  const bytes = Uint8Array.from([137, 80, 78, 71, 1, 2, 3, 4]);
  if (asset.stored !== false)
    await blobs.put(orgId, asset.key, asset.swapped ? Uint8Array.from([0, 0, 0]) : bytes);
  await db.insert(schema.asset).values({
    orgId,
    purpose: asset.purpose,
    visibility: "private",
    bucket: "receipts",
    key: asset.key,
    fileName: asset.key.split("/").pop()!,
    contentType: "image/png",
    sizeBytes: bytes.length,
    sha256: await sha256(bytes),
  });
}

const day = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

/** Another trading day: a copy of the org's first sale at a new time and total, paid by `tenders` (amounts in 1/10000). */
export async function addSale(
  db: schema.ShopperDatabase,
  orgId: string,
  sale: {
    on: string;
    receipt: string;
    total: number;
    tenders: { kind: "cash" | "card"; amount: number }[];
  },
) {
  const [base] = await db.select().from(schema.sale).where(eq(schema.sale.orgId, orgId)).limit(1);
  const [line] = await db
    .select()
    .from(schema.saleLine)
    .where(eq(schema.saleLine.saleId, base!.id));
  const id = crypto.randomUUID();
  await db.insert(schema.sale).values({
    ...base!,
    id,
    localId: id,
    receiptNumber: sale.receipt,
    occurredAt: day(sale.on),
    total: sale.total as never,
    storeSequence: null,
  });
  await db.insert(schema.saleLine).values({ ...line!, id: crypto.randomUUID(), saleId: id });
  for (const [position, tender] of sale.tenders.entries())
    await db
      .insert(schema.saleTender)
      .values({ orgId, saleId: id, position, kind: tender.kind, amount: tender.amount as never });
  return id;
}
