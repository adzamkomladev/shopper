import { add, fromDecimal, lineTotal as roundedTotal, money, type Money } from "@shopper/money";
import { parseQuantity } from "@shopper/utils";
import { ApiError } from "../../api/client";
import type { DraftLine, Failure, LineErrors, LineField } from "./types";

export const entryId = (field: string) => `entry-${field}`;
export const lineId = (productId: string, field: LineField) => entryId(`${field}-${productId}`);
export const SEARCH_ID = entryId("search");

/** Up to 5 whole digits and 4 decimals, so a line total can never leave the safe integer range. */
export function parseCost(text: string): Money | null {
  const trimmed = text.trim().replace(",", ".");
  return /^\d{1,5}(?:\.\d{1,4})?$/.test(trimmed) ? fromDecimal(trimmed) : null;
}

/** What is wrong with each line, per field; lines that are fine have no entry. */
export function lineErrors(lines: DraftLine[], costed: boolean): LineErrors {
  const found: LineErrors = {};
  for (const line of lines) {
    const quantity =
      parseQuantity(line.quantity) === null
        ? "Enter a quantity above 0, like 12 or 2.5"
        : undefined;
    const cost = costed && parseCost(line.cost) === null ? "Enter a cost like 9.50" : undefined;
    if (quantity || cost) found[line.productId] = { quantity, cost };
  }
  return found;
}

/** Quantity times unit cost rounded to the pesewa, once both are valid. */
export function lineTotal(line: DraftLine): Money | null {
  const quantity = parseQuantity(line.quantity);
  const cost = parseCost(line.cost);
  return quantity === null || cost === null ? null : roundedTotal(cost, quantity);
}

/** The rounded lines added up, and how many lines are left out for a missing or invalid quantity or cost. */
export function orderTotal(lines: DraftLine[]) {
  const totals = lines.map(lineTotal);
  return {
    total: totals.reduce<Money>((sum, line) => add(sum, line ?? money(0)), money(0)),
    excluded: totals.filter((line) => line === null).length,
  };
}

export const receiptLines = (lines: DraftLine[]) =>
  lines.map((line) => ({
    productId: line.productId,
    quantityThousandths: parseQuantity(line.quantity)!,
    unitCost: parseCost(line.cost)!,
  }));

export const adjustmentLines = (lines: DraftLine[]) =>
  lines.map((line) => ({
    productId: line.productId,
    quantityThousandths: parseQuantity(line.quantity)!,
  }));

const lineFields = { quantityThousandths: "quantity", unitCost: "cost" } as const;

/** The field the API named in its refusal: a head field, or a line's quantity or cost. */
export function failedField(error: unknown, lines: DraftLine[]): Failure | undefined {
  if (!(error instanceof ApiError) || !error.field) return undefined;
  const match = /^lines\.(\d+)\.(quantityThousandths|unitCost)$/.exec(error.field);
  const line = match && lines[Number(match[1])];
  if (match && line) {
    const field = lineFields[match[2] as keyof typeof lineFields];
    return {
      field: lineId(line.productId, field),
      message: error.message,
      line: { productId: line.productId, field },
    };
  }
  return { field: entryId(error.field), message: error.message };
}

/** The line errors with the API's refusal placed on the line field it named. */
export function withServerError(errors: LineErrors, failure?: Failure): LineErrors {
  const line = failure?.line;
  if (!line) return errors;
  return {
    ...errors,
    [line.productId]: { ...errors[line.productId], [line.field]: failure.message },
  };
}
