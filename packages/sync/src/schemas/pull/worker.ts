import * as v from "valibot";
import { sequenceSchema } from "@shopper/ports";

export type PullStatus = {
  state: "idle" | "offline" | "upgrade" | "snapshot" | "revoked" | "incompatible";
  cursor: string | null;
  head: string | null;
  syncing: boolean;
  lastPullAt: number | null;
};
export const snapshot = v.object({ snapshot: v.literal(true), head: sequenceSchema });

import { KNOWN_VERSION } from "./apply";
export const snapshotVersionSchema = v.object({
  v: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(KNOWN_VERSION)),
});
