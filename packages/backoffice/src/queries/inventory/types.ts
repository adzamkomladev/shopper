import type * as v from "valibot";
import type {
  documentDetail,
  documentSummary,
  stockItem,
  stockMovementView,
  stockProductView,
  stockValuationView,
  takeDetail,
  takeLine,
  takeSummary,
} from "@shopper/core/schemas";

export type StockItem = v.InferOutput<typeof stockItem>;
export type StockProduct = v.InferOutput<typeof stockProductView>;
export type StockMovement = v.InferOutput<typeof stockMovementView>;
export type StockSearch = { branch?: string; q?: string; low?: true; negative?: true };
export type RecordSummary = v.InferOutput<typeof documentSummary>;
export type RecordDetail = v.InferOutput<typeof documentDetail>;
export type RecordsSearch = { branch?: string; kind?: "received" | "adjusted" | "counted" };
export type TakeSummary = v.InferOutput<typeof takeSummary>;
export type TakeDetail = v.InferOutput<typeof takeDetail>;
export type TakeLine = v.InferOutput<typeof takeLine>;
export type Valuation = v.InferOutput<typeof stockValuationView>;
export type ValuationLine = Valuation["lines"][number];
