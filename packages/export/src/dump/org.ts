import { and, eq, inArray, sql } from "drizzle-orm";
import { asset, fiscalArchive, type ShopperDatabase } from "@shopper/db-pg";
import { describeFile } from "../manifest";
import type { DumpFile, DumpOptions, DumpResult } from "../types";
import { ARCHIVED_ASSET_PURPOSES, EXCLUDED_TABLES, HIDDEN_COLUMNS, MAX_BLOB_BYTES } from "./tables";

const FIRST_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Writes every row the org owns as `tables/<table>/<NNNN>.ndjson` pages of `pageRows` rows under `prefix`, all read in
 * one repeatable-read transaction so the pages are one moment in time while the shop keeps trading, then measures the
 * blobs those rows point at. Rows keep Postgres' own JSON text, so a 64-bit counter is never rounded.
 */
export async function dumpOrg(db: ShopperDatabase, options: DumpOptions): Promise<DumpResult> {
  const written: string[] = [];
  const pageRows = options.pageRows ?? 5000;
  const write = async (path: string, bytes: Uint8Array, key: string): Promise<DumpFile> => {
    written.push(key);
    await options.blobs.put(options.orgId, key, bytes);
    return { ...(await describeFile(path, bytes)), key };
  };
  try {
    const files: DumpFile[] = [];
    const keys = await db.transaction(
      async (tx) => {
        const tables = await tx.execute<{ table_name: string }>(sql`
          select c.table_name from information_schema.columns c
          join information_schema.tables t using (table_schema, table_name)
          where c.table_schema = 'public' and c.column_name = 'org_id' and t.table_type = 'BASE TABLE'
          order by c.table_name`);
        for (const { table_name: table } of tables.rows) {
          if (table in EXCLUDED_TABLES) continue;
          const hidden = sql`ARRAY[${sql.join(
            (HIDDEN_COLUMNS[table] ?? []).map((c) => sql`${c}`),
            sql`, `,
          )}]::text[]`;
          let last = FIRST_ID;
          for (let page = 1; ; page++) {
            const { rows } = await tx.execute<{ id: string; line: string }>(sql`
              select id::text as id, (to_jsonb(t) - ${hidden})::text as line
              from ${sql.identifier(table)} t
              where org_id = ${options.orgId} and id > ${last}::uuid
              order by id limit ${pageRows}`);
            if (!rows.length) break;
            const path = `tables/${table}/${String(page).padStart(4, "0")}.ndjson`;
            files.push(
              await write(
                path,
                new TextEncoder().encode(rows.map((row) => `${row.line}\n`).join("")),
                `${options.prefix}/${path}`,
              ),
            );
            last = rows.at(-1)!.id;
            if (rows.length < pageRows) break;
          }
          await options.afterTable?.(table);
        }
        const uploaded = await tx
          .select({ key: asset.key, bytes: asset.sizeBytes, sha256: asset.sha256 })
          .from(asset)
          .where(
            and(
              eq(asset.orgId, options.orgId),
              inArray(asset.purpose, [...ARCHIVED_ASSET_PURPOSES]),
            ),
          );
        const fiscal = await tx
          .select({
            key: fiscalArchive.key,
            bytes: fiscalArchive.bytes,
            sha256: fiscalArchive.sha256,
          })
          .from(fiscalArchive)
          .where(eq(fiscalArchive.orgId, options.orgId));
        return [...uploaded, ...fiscal].sort((a, b) => a.key.localeCompare(b.key));
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
    const missingBlobs: string[] = [];
    for (const registered of keys.filter(
      (row, i) => keys.findIndex((other) => other.key === row.key) === i,
    )) {
      const bytes = await options.blobs.get(options.orgId, registered.key, MAX_BLOB_BYTES);
      const file = bytes && (await describeFile(`blobs/${registered.key}`, bytes));
      // Only bytes that are the ones their row registered are signed as the business's own; the rest are named.
      if (file && file.bytes === registered.bytes && file.sha256 === registered.sha256)
        files.push({ ...file, key: registered.key });
      else missingBlobs.push(registered.key);
    }
    return { files, missingBlobs };
  } catch (error) {
    // A dump that fails leaves nothing of the org's data behind: the owner never sees this archive to delete it.
    await Promise.all(written.map((key) => options.blobs.delete(options.orgId, key)));
    throw error;
  }
}
