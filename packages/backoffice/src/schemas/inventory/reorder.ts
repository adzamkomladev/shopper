import * as v from "valibot";
import { formatQuantity, parseQuantity } from "@shopper/utils";

/** The reorder level in the product's own unit. Empty means no level. */
export const reorderSchema = v.object({
  level: v.pipe(
    v.string(),
    v.trim(),
    v.check(
      (text) => text === "" || parseQuantity(text, true) !== null,
      "Enter a quantity like 12 or 2.5",
    ),
  ),
});
export type ReorderValues = v.InferInput<typeof reorderSchema>;

export const levelText = (thousandths: number | null): string =>
  thousandths === null ? "" : formatQuantity(thousandths);

export const toReorderBody = (branchId: string, productId: string, { level }: ReorderValues) => ({
  branchId,
  productId,
  levelThousandths: level.trim() === "" ? null : parseQuantity(level, true),
});

/** What the PUT answers; the screen refetches the product, so only the level is read. */
export const reorderSet = v.object({ levelThousandths: v.nullable(v.number()) });
