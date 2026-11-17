import { desc, eq, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { buildInfo } from "@shopper/config";
import {
  auditLog,
  org,
  shopperMeta,
  type MoveCredentials,
  type ShopperTransaction,
} from "@shopper/db-pg";
import type { ImportInput } from "../types";
import { sha256 } from "@shopper/utils";
import { ARCHIVE_FORMAT } from "../schemas/manifest";
import { ImportError } from "./error";
import { archivedDeparture } from "../onprem/start";
import { tableOrder } from "./order";

/**
 * Writes a whole archive into this database as the org it came from: every row with its own ids, codes and counters,
 * every file checked against the manifest as it is read. One transaction: a file that is not the signed one leaves
 * nothing behind, and once the org exists a second run is a no-op. The one exception is a shop coming back from its
 * box: the cloud's archived copy is deleted first, in the same transaction, and the box's rows take its place.
 */
export const importArchive = defineCommand({
  name: "migration.import",
  async replay(tx, ctx) {
    const [found] = await tx.select({ id: org.id }).from(org).where(eq(org.id, ctx.orgId));
    if (!found || (await archivedDeparture(tx, ctx.orgId))) return undefined;
    return { output: { imported: false, rows: 0, files: 0 } };
  },
  async run(tx, ctx, input: ImportInput) {
    const manifest = input.manifest;
    if (manifest.org.id !== ctx.orgId)
      throw new ImportError("This archive is another shop's.", 403);
    if (manifest.schema_version > buildInfo.schemaVersion)
      throw new ImportError(
        `This archive was made by a newer Shopper (${manifest.product_version}). Update this Shopper before importing it.`,
        409,
      );
    const replaced = (await archivedDeparture(tx, ctx.orgId))
      ? await replaceOrg(tx, ctx.orgId)
      : undefined;
    for (const blob of manifest.blobs)
      await input.blobs.put(
        ctx.orgId,
        blob.path.slice("blobs/".length),
        await checked(input, blob),
      );
    await tx.execute(sql`select set_config('shopper.import', 'on', true)`);
    let rows = 0;
    let files = manifest.blobs.length;
    for (const table of await tableOrder(tx, Object.keys(manifest.tables))) {
      const columns = await insertable(tx, table);
      for (const file of manifest.tables[table]!.files) {
        // Lines stay Postgres' own JSON text: parsed here only for their keys, so a 64-bit counter is never rounded.
        const records = new TextDecoder()
          .decode(await checked(input, file))
          .split("\n")
          .filter(Boolean);
        if (!records.length) continue;
        const passwords = table === "account" ? (input.credentials?.passwords ?? []) : [];
        // Columns the archive lacks (it predates them) take their defaults: additive changes need no upcaster.
        const keys = new Set(records.flatMap((line) => Object.keys(JSON.parse(line) as object)));
        if (passwords.length) keys.add("password");
        const list = sql.join(
          columns.filter((column) => keys.has(column)).map((column) => sql.identifier(column)),
          sql`, `,
        );
        const recordset = sql`jsonb_populate_recordset(null::${sql.identifier(table)}, ${withPasswords(`[${records.join(",")}]`, passwords)})`;
        // A box signs its own manifest, so a crafted archive is self-consistent: every row must be this shop's.
        const owner = sql.identifier(table === "org" ? "id" : "org_id");
        const { rows: foreign } = await tx.execute(
          sql`select 1 from ${recordset} where ${owner} is distinct from ${ctx.orgId} limit 1`,
        );
        if (foreign.length)
          throw new ImportError("This archive holds records of another shop.", 403);
        await tx.execute(sql`
          insert into ${sql.identifier(table)} (${list}) overriding system value
          select ${list} from ${recordset}`);
        rows += records.length;
        files += 1;
      }
    }
    await tx.execute(sql`select set_config('shopper.import', 'off', true)`);
    if (input.credentials) await applyCredentials(tx, ctx.orgId, input.credentials);
    await raiseFloors(tx, ctx.orgId);
    await tx.insert(shopperMeta).values({
      orgId: ctx.orgId,
      productVersion: ctx.appVersion,
      event: "install",
      schemaVersion: buildInfo.schemaVersion,
      syncProtocol: buildInfo.syncProtocol,
      archiveFormat: ARCHIVE_FORMAT,
    });
    return { imported: true, rows, files, ...(replaced && { replaced }) };
  },
  audit: (input, output) => ({
    archiveCreatedAt: input.manifest.created_at,
    productVersion: input.manifest.product_version,
    imported: output.imported,
    rows: output.rows,
    files: output.files,
    passwords: input.credentials?.passwords.length ?? 0,
    pins: input.credentials?.pins.length ?? 0,
    ...input.source,
    // The archived copy's chain head: the history the cloud wrote after the shop left ends here.
    ...("replaced" in output && { replaced: output.replaced }),
  }),
});

/**
 * Deletes every row of an org the cloud holds only as an archived departure, children before parents, with the
 * history guards standing aside for this org alone. Its departure's own bookkeeping goes too, so the shop is no longer
 * frozen; the import that follows writes the box's continuation of the same history. Answers the deleted chain's
 * head, which the import's audit row keeps.
 */
async function replaceOrg(tx: ShopperTransaction, orgId: string) {
  const [head] = await tx
    .select({ chainSeq: auditLog.chainSeq, hash: auditLog.hash })
    .from(auditLog)
    .where(eq(auditLog.orgId, orgId))
    .orderBy(desc(auditLog.chainSeq))
    .limit(1);
  await tx.execute(sql`select set_config('shopper.replace', ${orgId}, true)`);
  const { rows } = await tx.execute<{ table_name: string }>(sql`
    select c.table_name from information_schema.columns c
    join information_schema.tables t using (table_schema, table_name)
    where c.table_schema = 'public' and c.column_name = 'org_id' and t.table_type = 'BASE TABLE'
      and c.table_name <> 'archive_import'`);
  const tables = await tableOrder(tx, [...rows.map((row) => row.table_name), "org"]);
  for (const table of tables.reverse())
    await tx.execute(
      sql`delete from ${sql.identifier(table)} where ${sql.identifier(table === "org" ? "id" : "org_id")} = ${orgId}`,
    );
  await tx.execute(sql`select set_config('shopper.replace', '', true)`);
  return head ?? null;
}

/** A file's bytes, refused unless they are exactly the ones the manifest signed. */
async function checked(input: ImportInput, file: { path: string; bytes: number; sha256: string }) {
  const bytes = await input.read(file.path);
  if (!bytes) throw new ImportError(`${file.path} is missing.`, 409);
  if (bytes.length !== file.bytes || (await sha256(bytes)) !== file.sha256)
    throw new ImportError(`${file.path} is not the file the archive signed.`, 422);
  return bytes;
}

async function insertable(tx: ShopperTransaction, table: string) {
  const { rows } = await tx.execute<{ name: string }>(sql`
    select attname as name from pg_attribute
    where attrelid = ${table}::regclass and attnum > 0 and not attisdropped and attgenerated = ''
    order by attnum`);
  return rows.map((row) => row.name);
}

/**
 * The rows as a jsonb array; for `account`, a move's password hashes merged into its credential rows as they are
 * written, so the rows stay exactly as the box had them.
 */
function withPasswords(rows: string, passwords: MoveCredentials["passwords"]) {
  if (!passwords.length) return sql`${rows}::jsonb`;
  const byUser = JSON.stringify(Object.fromEntries(passwords.map((p) => [p.userId, p.password])));
  return sql`(
    select jsonb_agg(case when row->>'provider_id' = 'credential' and ${byUser}::jsonb ? (row->>'user_id')
      then row || jsonb_build_object('password', ${byUser}::jsonb->(row->>'user_id')) else row end)
    from jsonb_array_elements(${rows}::jsonb) row)`;
}

/** PINs and the session key travel with a move, never in the archive file. */
async function applyCredentials(
  tx: ShopperTransaction,
  orgId: string,
  credentials: MoveCredentials,
) {
  for (const entry of credentials.pins)
    await tx.execute(sql`
      insert into cashier_pin (org_id, user_id, pin_hash) values (${orgId}, ${entry.userId}, ${entry.pinHash})
      on conflict (org_id, user_id) do update set pin_hash = excluded.pin_hash`);
  if (credentials.sessionKey)
    await tx.execute(sql`
      insert into session_key (org_id, key) values (${orgId}, ${credentials.sessionKey})
      on conflict (org_id) do update set key = excluded.key`);
}

/**
 * A belt over the imported counters: each store's sequence continues above anything it ever numbered, and each
 * register's receipt blocks continue above the last one it was given.
 */
async function raiseFloors(tx: ShopperTransaction, orgId: string) {
  // Only rows below their floor are touched, so the rest keep their `updated_at` exactly as the box had it.
  await tx.execute(sql`
    update store s set last_seq = f.floor
    from (select s2.id, greatest(
      (select max(store_sequence) from sale where org_id = s2.org_id and store_id = s2.id),
      (select max(seq) from store_change where org_id = s2.org_id and store_id = s2.id)) as floor
      from store s2 where s2.org_id = ${orgId}) f
    where s.id = f.id and s.last_seq < f.floor`);
  await tx.execute(sql`
    update device d set receipt_last = f.floor
    from (select device_id, max("end") as floor from receipt_block
      where org_id = ${orgId} group by device_id) f
    where d.org_id = ${orgId} and d.id = f.device_id and d.receipt_last < f.floor`);
}
