import { adjustmentInput } from "@shopper/core/schemas";
import type { RecordSummary, RecordsSearch } from "../../queries/inventory/types";
import type { Cause, Direction } from "./types";

type ApiKind = RecordSummary["kind"];
type Kind = NonNullable<RecordsSearch["kind"]>;

/** The page's kinds in the words people use, and the API's kind for each. */
export const KINDS: readonly { kind: Kind; api: ApiKind; label: string }[] = [
  { kind: "received", api: "receipt", label: "Received" },
  { kind: "adjusted", api: "adjustment", label: "Adjusted" },
  { kind: "counted", api: "count", label: "Counted" },
];

export const kindOf = (api: ApiKind) => KINDS.find((entry) => entry.api === api)!;

export const CAUSES = adjustmentInput.entries.cause.options;

export const CAUSE_LABELS: Record<string, string> = {
  damaged: "Damaged",
  expired: "Expired",
  theft: "Theft",
  found: "Found",
  other: "Other",
};

/** Damaged, expired and theft take stock out and found puts it in; "other" is the person's choice. */
export const CAUSE_SIGNS: Record<Exclude<Cause, "other">, 1 | -1> = {
  damaged: -1,
  expired: -1,
  theft: -1,
  found: 1,
};

/** What a record is called as a page title. */
export const RECORD_TITLES: Record<ApiKind, string> = {
  receipt: "Goods received",
  adjustment: "Stock adjustment",
  count: "Stock count",
};

/** Which way an adjustment moves stock, or null until the cause (and for "other" the direction) is chosen. */
export function adjustmentSign(cause: Cause | "", direction: Direction | ""): 1 | -1 | null {
  if (cause === "") return null;
  if (cause !== "other") return CAUSE_SIGNS[cause];
  return direction === "" ? null : direction === "add" ? 1 : -1;
}
