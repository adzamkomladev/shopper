// The lane the shared test API is built with: it records every enqueue and forwards to a real lane once a suite
// sets one, so document suites see what was queued and lane suites see it submitted.
import type { Lane } from "@shopper/ports";

export const enqueued: { orgId: string; storeId: string; docId: string }[] = [];
let target: Lane | undefined;
export const lane: Lane = {
  async enqueue(orgId, storeId, docId) {
    enqueued.push({ orgId, storeId, docId });
    await target?.enqueue(orgId, storeId, docId);
  },
};
export const useLane = (next: Lane | undefined) => void (target = next);
