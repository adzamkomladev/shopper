import type { Money } from "@shopper/money";
import type * as v from "valibot";
import type { tillConfiguration } from "../schemas/till/config";

export type TillConfig = v.InferOutput<typeof tillConfiguration> & { now?: () => Date };

export type ScanResult = {
  kind: "barcode" | "weight" | "price";
  productId: string;
  quantityThousandths: number;
  gross?: Money;
};
