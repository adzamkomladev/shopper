import type { BridgeMessage } from "@shopper/sync/bridge";
import type { SaleFailure, SaleSnapshot } from "./types";

export function failureOf(reply: Extract<BridgeMessage, { type: "error" }>): SaleFailure | null {
  if (reply.code === "SESSION_REQUIRED" || reply.code === "session") return "session";
  if (reply.code === "permission" || reply.code === "scope") return "permission";
  if (reply.code === "STORAGE_FAILED") return "storage";
  return null;
}

/** Replies and broadcasts race on the bridge; a draft never moves back to an older revision. */
export function isOlder(next: SaleSnapshot["view"], current: SaleSnapshot["view"]) {
  const [a, b] = [next?.draft, current?.draft];
  return !!a && !!b && a.id === b.id && a.revision < b.revision;
}
