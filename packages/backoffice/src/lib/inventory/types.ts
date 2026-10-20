import type * as v from "valibot";
import type { adjustmentInput } from "@shopper/core/schemas";

/** A product on a receipt or adjustment being typed: the quantity and cost are text until it is saved. */
export type DraftLine = {
  productId: string;
  sku: string;
  name: string;
  baseUnit: string;
  quantity: string;
  cost: string;
};
export type LineField = "quantity" | "cost";
export type LineErrors = Record<string, Partial<Record<LineField, string>>>;

/** The field the API named in its refusal: a head field, or a line's quantity or cost. */
export type Failure = {
  field: string;
  message: string;
  line?: { productId: string; field: LineField };
};

export type Cause = v.InferOutput<typeof adjustmentInput>["cause"];
export type Direction = "add" | "remove";
/** A supplier as the picker holds it, so one just added reads before the list refetches. */
export type Chosen = { id: string; name: string };

/** What a line does to stock. The words say it and the badge colour backs them up, so the sign never rests on colour alone. */
export type Effect = { text: string; tone: "add" | "remove" | "unset" };
