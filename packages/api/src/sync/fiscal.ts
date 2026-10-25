import type { ShopperDatabase } from "@shopper/db-pg";
import type { Lane } from "@shopper/ports";
import { oldestStrandedFiscalDoc, STRANDED_AFTER_MS } from "@shopper/core/fiscal";
import type { Principal } from "./types";

/**
 * Queues an accepted VAT document on its store's lane. Fiscalisation never fails an upload: a lost enqueue is picked
 * up by the store's next pull (`sweepStrandedFiscal`) or when the till uploads the same event again.
 */
export async function enqueueFiscal(
  lane: Lane | undefined,
  principal: Principal,
  docId: string | null,
) {
  if (!lane || !docId) return;
  await lane
    .enqueue(principal.orgId, principal.storeId, docId)
    .catch((error: unknown) =>
      console.error({ event: "fiscal.enqueue_failed", orgId: principal.orgId, docId, error }),
    );
}

/**
 * Runs on every pull: tills pull at least every five minutes, so a store's stranded document goes back on its lane
 * without a timer of its own. Re-enqueueing a queued document is a no-op that keeps a failing head's backoff.
 */
export async function sweepStrandedFiscal(
  database: ShopperDatabase,
  lane: Lane | undefined,
  principal: Principal,
) {
  if (!lane) return;
  const before = new Date(Date.now() - STRANDED_AFTER_MS);
  await enqueueFiscal(lane, principal, await oldestStrandedFiscalDoc(database, principal, before));
}
