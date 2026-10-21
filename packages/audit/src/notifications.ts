import type { Envelope } from "@shopper/ports";
import type { ShopperTransaction } from "@shopper/db-pg";

const changes = new WeakMap<ShopperTransaction, Map<string, string>>();

export function collectStoreChanges(tx: ShopperTransaction, heads: Map<string, string>) {
  changes.set(tx, heads);
}

export function notifyStoreChanged(tx: ShopperTransaction, storeId: string, sequence: string) {
  changes.get(tx)?.set(storeId, sequence);
}

const envelopes = new WeakMap<ShopperTransaction, Envelope[]>();

export function collectEnvelopes(tx: ShopperTransaction, queued: Envelope[]) {
  envelopes.set(tx, queued);
}

/** Queues a message for the command's `queue`; it is sent only once the transaction commits. */
export function enqueueAfterCommit(tx: ShopperTransaction, envelope: Envelope) {
  envelopes.get(tx)?.push(envelope);
}
