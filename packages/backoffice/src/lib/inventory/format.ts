import { formatQuantity } from "@shopper/utils";

/** An amount in its base unit: "21.5 kg", "0 each". */
export const quantityLabel = (thousandths: number, unit: string) =>
  `${formatQuantity(thousandths)} ${unit}`;

/** A movement's change with its sign always shown: "+24 kg", "−2.5 kg". */
export const changeLabel = (thousandths: number, unit: string) =>
  `${thousandths > 0 ? "+" : ""}${quantityLabel(thousandths, unit)}`;

/** What a stock movement is called on screen. */
export const REASON_LABELS: Record<string, string> = {
  sale: "Sale",
  return: "Return",
  receipt: "Received",
  adjustment: "Adjustment",
  count: "Stock count",
};

/** The requested branch if the shop has it, else the first (they arrive sorted by name). */
export function pickBranch<B extends { id: string }>(branches: readonly B[], requested?: string) {
  return branches.find((branch) => branch.id === requested) ?? branches[0];
}

/** The most movements a product's page shows; the API returns no more than this. */
export const MOVEMENT_LIMIT = 200;
