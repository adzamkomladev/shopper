import type { Money } from "@shopper/money";
import type { TillError } from "./error";
import type * as v from "valibot";
import type { quoteFrom } from "./quotation";
import type { viewDraft } from "./drafts/queries";
import type { tillConfiguration } from "../schemas/till/config";

export type TillConfig = v.InferOutput<typeof tillConfiguration> & { now?: () => Date };

export type ScanResult = {
  productId: string;
  quantityThousandths: number;
} & (
  | { kind: "barcode" | "weight"; gross?: never; originalPriceId?: never }
  | { kind: "price"; gross: Money; originalPriceId: string }
);

export type QuoteLine =
  | ({ lineId: string; error?: never } & ReturnType<typeof quoteFrom>)
  | { lineId: string; productId: string; error: TillError["code"]; tax?: never };
export type DraftView = Awaited<ReturnType<typeof viewDraft>>;

/** How one print attempt ended: the automatic copy, a reprint or a failure. */
export type PrintOutcome = "first" | "reprint" | { error: string };
