import { add, money, type Money } from "@shopper/money";
import { formatQuantity, parseQuantity } from "@shopper/utils";
import { ApiError } from "../../api/client";
import type { TakeLine, TakeSummary } from "../../queries/inventory/types";

export const SHEET_HEADING_ID = "take-heading";
export const REVIEW_ID = "take-review";
export const CANCEL_ID = "take-cancel";
export const countId = (productId: string) => `take-count-${productId}`;

export const STATUS_LABELS = { open: "Open", posted: "Posted", cancelled: "Cancelled" } as const;

/** What a take covers, in the words people use. */
export const scopeLabel = (take: Pick<TakeSummary, "scope" | "categoryName">) =>
  take.scope === "full" ? "Whole branch" : (take.categoryName ?? "One category");

export const isCounted = (line: TakeLine) => line.countedThousandths !== null;

/** What a count box shows: the typed text, else the saved count, else nothing. */
export function countText(line: TakeLine, drafts: Record<string, string>) {
  return (
    drafts[line.productId] ??
    (line.countedThousandths === null ? "" : formatQuantity(line.countedThousandths))
  );
}

/** A count, with zero allowed: a shelf can be empty. Null when the text is not a quantity. */
export const parseCount = (text: string) => parseQuantity(text, true);

/** Typed counts that differ from what is saved and are valid, ready to be sent. */
export function unsavedCounts(lines: TakeLine[], drafts: Record<string, string>) {
  return lines.flatMap((line) => {
    const typed = drafts[line.productId];
    const count = typed === undefined ? null : parseCount(typed);
    return count === null || count === line.countedThousandths
      ? []
      : [{ productId: line.productId, countedThousandths: count }];
  });
}

export const isUnsaved = (line: TakeLine, drafts: Record<string, string>) =>
  unsavedCounts([line], drafts).length > 0;

/** The variance of the whole sheet: how many lines moved, what they are worth, and how many could not be valued. */
export function reviewTotals(lines: TakeLine[]) {
  let moved = 0;
  let unvalued = 0;
  let value: Money = money(0);
  for (const line of lines) {
    if (!line.varianceThousandths) continue;
    moved++;
    if (line.varianceValue === null) unvalued++;
    else value = add(value, money(line.varianceValue));
  }
  return { moved, unvalued, value };
}

type Problem =
  | { kind: "not_counted" | "closed" | "open"; message: string }
  | { kind: "superseded"; message: string; productId?: string }
  | { kind: "other"; message: string };

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

/** A refused count, post or start, by the API's reason; the SUPERSEDED message names the product it found a newer count for. */
export function takeProblem(error: Error | null): Problem | undefined {
  if (!error) return undefined;
  const message = error.message;
  const code = error instanceof ApiError ? error.code : undefined;
  if (code === "NOT_COUNTED") return { kind: "not_counted", message };
  if (code === "TAKE_CLOSED") return { kind: "closed", message };
  if (code === "TAKE_OPEN") return { kind: "open", message };
  if (code === "SUPERSEDED")
    return { kind: "superseded", message, productId: UUID.exec(message)?.[0] };
  return { kind: "other", message };
}
