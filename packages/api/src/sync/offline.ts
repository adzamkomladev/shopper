import { buildInfo } from "@shopper/config";
import { adoptOfflineSession, restoreServerSession, SaleError } from "@shopper/core/sales";
import type { OfflineSession } from "@shopper/core/schemas";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { Principal } from "./types";

/**
 * Records the session a till request acts under before the request runs, whichever lane reaches the server
 * first: its server session from the signed grant when a restore lost it, then an offline session under it. One
 * that does not check out stays unknown, and the lane's session check refuses the request like any other.
 */
export async function adoptSession(
  database: ShopperDatabase,
  principal: Principal,
  credential: { proof: string; offline?: OfflineSession; grant?: string },
) {
  // An offline proof is its server session's proof, a dot and its own id.
  const serverProof = credential.offline
    ? credential.proof.slice(0, credential.proof.lastIndexOf("."))
    : credential.proof;
  if (credential.grant)
    await recorded(
      restoreServerSession(
        database,
        principal,
        { proof: serverProof, grant: credential.grant },
        buildInfo.version,
      ),
    );
  if (!credential.offline) return false;
  return recorded(
    adoptOfflineSession(
      database,
      principal,
      { proof: credential.proof, offline: credential.offline },
      buildInfo.version,
    ),
  );
}

function recorded(command: Promise<unknown>) {
  return command.then(
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
