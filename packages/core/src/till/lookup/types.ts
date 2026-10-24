import type * as v from "valibot";
import type { tillCustomer } from "../../schemas/till/reference";

export type ProjectedProduct = {
  id: string;
  sku: string;
  name: string;
  archivedAt: string | null;
  barcodes: { code: string; quantityThousandths: number }[];
};

export type CatalogueMatch = {
  productId: string;
  sku: string;
  name: string;
  match: "barcode" | "sku" | "name";
  barcode?: string;
  quantityThousandths?: number;
};

export type ProjectedCustomer = Pick<
  v.InferOutput<typeof tillCustomer>,
  | "id"
  | "name"
  | "phone"
  | "kind"
  | "businessName"
  | "tin"
  | "version"
  | "archivedAt"
  | "mergedIntoId"
>;
