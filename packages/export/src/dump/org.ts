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
  const pageRows = options.pageRows ?? 5000;
  const write = async (path: string, bytes: Uint8Array, key: string): Promise<DumpFile> => {
    await options.blobs.put(options.orgId, key, bytes);
    return { ...(await describeFile(path, bytes)), key };
  };
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
        .select({ key: asset.key })
        .from(asset)
        .where(
          and(eq(asset.orgId, options.orgId), inArray(asset.purpose, [...ARCHIVED_ASSET_PURPOSES])),
        );
      const fiscal = await tx
        .select({ key: fiscalArchive.key })
        .from(fiscalArchive)
        .where(eq(fiscalArchive.orgId, options.orgId));
      return [...new Set([...uploaded, ...fiscal].map((row) => row.key))].sort();
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
  const missingBlobs: string[] = [];
  for (const key of keys) {
    const bytes = await options.blobs.get(options.orgId, key, MAX_BLOB_BYTES);
    if (bytes) files.push({ ...(await describeFile(`blobs/${key}`, bytes)), key });
    else missingBlobs.push(key);
  }
  return { files, missingBlobs };
}
