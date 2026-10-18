import { parseQuantity } from "@shopper/utils";
import type { DraftLine, Kind } from "./types";

/** Ids are per document kind, because the count and the delivery drafts are both mounted. */
export const quantityId = (kind: Kind, productId: string) => `quantity-${kind}-${productId}`;
export const searchId = (kind: Kind) => `search-${kind}`;

/** The thousandths a line holds, or null when the text is not a quantity this kind of document takes. */
export const lineQuantity = (kind: Kind, line: DraftLine) =>
  parseQuantity(line.quantity, kind === "count");

/** Per product, what is wrong with its quantity; products that are fine have no entry. */
export function lineErrors(kind: Kind, lines: DraftLine[]) {
  const message =
    kind === "count" ? "Enter the quantity counted, like 12 or 2.5" : "Enter a quantity above 0";
  return Object.fromEntries(
    lines
      .filter((line) => lineQuantity(kind, line) === null)
      .map((line) => [line.productId, message]),
  );
}

/** The host's document body for these lines (the host adds who and when). */
export function documentLines(kind: Kind, lines: DraftLine[]) {
  return lines.map((line) => {
    const thousandths = lineQuantity(kind, line)!;
    return kind === "count"
      ? { productId: line.productId, countedThousandths: thousandths }
      : { productId: line.productId, quantityThousandths: thousandths };
  });
}
