import type { Money } from "@shopper/money";
import type { TillError } from "./error";
import type * as v from "valibot";
import type { quoteFrom } from "./quotation";
import type { viewDraft } from "./drafts/queries";
import type { tillConfiguration } from "../schemas/till/config";

export type TillConfig = v.InferOutput<typeof tillConfiguration> & { now?: () => Date };

export type ScanResult = {
  kind: "barcode" | "weight" | "price";
  productId: string;
  quantityThousandths: number;
  gross?: Money;
};

export type QuoteLine =
  | ({ lineId: string; error?: never } & ReturnType<typeof quoteFrom>)
  | { lineId: string; productId: string; error: TillError["code"]; tax?: never };
export type DraftView = Awaited<ReturnType<typeof viewDraft>>;
