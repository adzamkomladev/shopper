import type { Lane } from "@shopper/ports";
import type { Principal } from "./types";

/**
 * Queues an accepted VAT document on its store's lane. Fiscalisation never fails an upload: a lost enqueue is picked
 * up when the till uploads the same event again (a replay queues it again) or by the lane's sweep of its store.
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
