import { and, eq } from "drizzle-orm";
import { productImport, type ShopperDatabase, type ShopperTransaction } from "@shopper/db-pg";
import { recordId } from "../records";
import type { ImportError } from "./types";

export async function readImportedAsset(
  db: ShopperDatabase | ShopperTransaction,
  orgId: string,
  assetId: string,
) {
  const [saved] = await db
    .select()
    .from(productImport)
    .where(and(eq(productImport.orgId, orgId), eq(productImport.assetId, recordId(assetId))));
  if (!saved) return undefined;
  return {
    id: saved.id,
    sha256: saved.sha256,
    rowsTotal: saved.rowsTotal,
    rowsOk: saved.rowsOk,
    rowsFailed: saved.rowsFailed,
    ...(saved.report as {
      errors: ImportError[];
      created: number;
      updated: number;
      unchanged: number;
      pricesAdded: number;
    }),
  };
}
