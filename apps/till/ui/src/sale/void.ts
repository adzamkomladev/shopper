import type { DraftView } from "./types";

/** The tender that was already taken on a basket (cash first), which only a manager can undo; null when none was. */
export function takenTender(draft: DraftView["draft"]): "cash" | "card" | null {
  const taken = draft?.tenders.filter(
    (tender) => tender.kind !== "momo" && tender.status === "applied",
  );
  if (!taken?.length) return null;
  return taken.some((tender) => tender.kind === "cash") ? "cash" : "card";
}
