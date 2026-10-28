import { buildInfo } from "@shopper/config";
import { adoptOfflineSession, SaleError } from "@shopper/core/sales";
import type { OfflineSession } from "@shopper/core/schemas";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { Principal } from "./types";

/**
 * Adopts the offline session a till request acts under before the request runs, whichever lane reaches the
 * server first. One that does not follow from its parent stays unknown, and the lane's session check refuses
 * the request like any other.
 */
export async function adoptSession(
  database: ShopperDatabase,
  principal: Principal,
  credential: { proof: string; offline?: OfflineSession },
) {
  if (!credential.offline) return false;
  return adoptOfflineSession(
    database,
    principal,
    { proof: credential.proof, offline: credential.offline },
    buildInfo.version,
  ).then(
    () => true,
    (error: unknown) => {
      // A concurrent copy of this request may have adopted it first.
      const pg = error as { code?: string; cause?: { code?: string } };
      if ((pg?.code ?? pg?.cause?.code) === "23505") return true;
      if (error instanceof SaleError) return false;
      throw error;
    },
  );
}
