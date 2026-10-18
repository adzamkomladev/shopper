import type { StockProduct } from "../../schemas/stock/queue";

export type DraftLine = StockProduct & { quantity: string };
export type Kind = "count" | "receipt";
