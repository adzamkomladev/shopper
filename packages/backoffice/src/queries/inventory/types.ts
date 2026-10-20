import type * as v from "valibot";
import type {
  documentDetail,
  documentSummary,
  stockItem,
  stockMovementView,
  stockProductView,
} from "@shopper/core/schemas";

export type StockItem = v.InferOutput<typeof stockItem>;
export type StockProduct = v.InferOutput<typeof stockProductView>;
export type StockMovement = v.InferOutput<typeof stockMovementView>;
export type StockSearch = { branch?: string; q?: string; low?: true };
export type RecordSummary = v.InferOutput<typeof documentSummary>;
export type RecordDetail = v.InferOutput<typeof documentDetail>;
export type RecordsSearch = { branch?: string; kind?: "received" | "adjusted" | "counted" };
