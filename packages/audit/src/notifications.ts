import type { ShopperTransaction } from "@shopper/db-pg";

const changes = new WeakMap<ShopperTransaction, Map<string, string>>();

export function collectStoreChanges(tx: ShopperTransaction, heads: Map<string, string>) {
  changes.set(tx, heads);
}

export function notifyStoreChanged(tx: ShopperTransaction, storeId: string, sequence: string) {
  changes.get(tx)?.set(storeId, sequence);
}
