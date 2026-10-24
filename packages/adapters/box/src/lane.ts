import type { ShopperDatabase } from "@shopper/db-pg";
import type { Lane, Sdc } from "@shopper/ports";
import {
  laneBackoff,
  strandedFiscalDocs,
  submitFiscalDoc,
  waitingFiscalStores,
  STRANDED_AFTER_MS,
} from "@shopper/core/fiscal";

type Store = {
  orgId: string;
  storeId: string;
  queue: string[];
  attempts: number;
  running?: Promise<void>;
  timer?: ReturnType<typeof setTimeout>;
};

// ponytail: the queue lives in this process and is rebuilt from PostgreSQL by `relaunch` at boot; Rivet actors replace
// it on Day 36.
/** The box twin of the FiscalLane Durable Object: one ordered lane per store, retrying its head with backoff. */
export function boxLane(deps: {
  db: ShopperDatabase;
  sdc: Sdc;
  appVersion: string;
  now?: () => number;
}) {
  const now = deps.now ?? Date.now;
  const stores = new Map<string, Store>();
  const storeOf = (orgId: string, storeId: string) => {
    const key = `${orgId}/${storeId}`;
    const known = stores.get(key);
    if (known) return known;
    const store: Store = { orgId, storeId, queue: [], attempts: 0 };
    stores.set(key, store);
    return store;
  };
  const kick = (store: Store) => {
    if (store.running || store.timer) return store.running;
    store.running = drain(store).finally(() => (store.running = undefined));
    return store.running;
  };
  async function drain(store: Store) {
    for (;;) {
      const head = store.queue[0];
      if (!head) {
        const stranded = await strandedFiscalDocs(
          deps.db,
          store,
          new Date(now() - STRANDED_AFTER_MS),
          [],
        );
        for (const id of stranded.ready) if (!store.queue.includes(id)) store.queue.push(id);
        // An enqueue may have landed while the query ran.
        if (store.queue.length) continue;
        if (stranded.later) schedule(store, STRANDED_AFTER_MS);
        return;
      }
      const outcome = await submitFiscalDoc(
        deps.db,
        { orgId: store.orgId, appVersion: deps.appVersion },
        deps.sdc,
        head,
      ).catch((error: unknown) => {
        // The database itself failed; the head stays first and is tried again later.
        console.error({ event: "fiscal.lane_failed", orgId: store.orgId, docId: head, error });
        return "retry" as const;
      });
      if (outcome === "done") {
        store.queue.shift();
        store.attempts = 0;
        continue;
      }
      store.attempts += 1;
      schedule(store, laneBackoff(store.attempts));
      return;
    }
  }
  function schedule(store: Store, ms: number) {
    store.timer = setTimeout(() => {
      store.timer = undefined;
      void kick(store);
    }, ms);
  }
  const lane = {
    async enqueue(orgId: string, storeId: string, docId: string) {
      const store = storeOf(orgId, storeId);
      if (!store.queue.includes(docId)) store.queue.push(docId);
      // Only a failing head's backoff holds a new document back; a later look for stranded ones does not.
      if (!store.attempts) {
        clearTimeout(store.timer);
        store.timer = undefined;
      }
      void kick(store);
    },
    /** Tries the store's head now instead of waiting out its backoff; resolves when the lane stops again. */
    async wake(orgId: string, storeId: string) {
      const store = storeOf(orgId, storeId);
      await store.running;
      clearTimeout(store.timer);
      store.timer = undefined;
      await kick(store);
    },
    /** Documents still queued for a store. */
    waiting: (orgId: string, storeId: string) => storeOf(orgId, storeId).queue.length,
    /** At boot: every store with documents still waiting for the SDC gets its lane back, oldest first. */
    async relaunch() {
      for (const scope of await waitingFiscalStores(deps.db)) {
        const store = storeOf(scope.orgId, scope.storeId);
        const stranded = await strandedFiscalDocs(deps.db, scope, new Date(now()), store.queue);
        store.queue.push(...stranded.ready);
        void kick(store);
      }
    },
    close() {
      for (const store of stores.values()) clearTimeout(store.timer);
    },
  };
  return lane satisfies Lane;
}
