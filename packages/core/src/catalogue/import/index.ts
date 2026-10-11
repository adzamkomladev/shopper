import { and, eq } from "drizzle-orm";
import type { CommandContext } from "@shopper/audit";
import { productImport, type ShopperDatabase } from "@shopper/db-pg";
import { ManagementError, managementJson } from "../../management";
import { recordId } from "../schema";
import { importCatalogue } from "./apply";
import { parseSheet } from "./parse";
import { planImport } from "./plan";
import { validateRows } from "./validate";

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Dry run: parse, validate and check the database, and write nothing at all. */
export async function previewImport(db: ShopperDatabase, orgId: string, bytes: Uint8Array) {
  const { headers, rows } = parseSheet(bytes);
  const { good, errors } = validateRows(rows, headers);
  const plan = await planImport(db, orgId, good, headers, new Date());
  const all = [...errors, ...plan.errors].sort((a, b) => a.row - b.row);
  return {
    dryRun: true as const,
    rowsTotal: rows.length,
    rowsOk: plan.planned.length,
    rowsFailed: new Set(all.map((e) => e.row)).size,
    ...plan.counts,
    errors: all,
  };
}

export async function runImport(
  db: ShopperDatabase,
  context: CommandContext,
  bytes: Uint8Array,
  fileName: string,
) {
  const { headers, rows } = parseSheet(bytes);
  const { good, errors } = validateRows(rows, headers);
  const result = await importCatalogue(db, context, {
    fileName,
    sha256: await sha256(bytes),
    rowsTotal: rows.length,
    rows: good,
    errors,
    headers,
  });
  const { sha256: _hash, ...rest } = result;
  return { dryRun: false as const, ...rest };
}

export async function readImport(db: ShopperDatabase, orgId: string, id: string) {
  const [row] = await db
    .select()
    .from(productImport)
    .where(and(eq(productImport.orgId, orgId), eq(productImport.id, recordId(id))));
  if (!row) throw new ManagementError("Record not found");
  const { actorId: _actor, updatedAt: _updated, ...rest } = row;
  return managementJson(rest);
}
