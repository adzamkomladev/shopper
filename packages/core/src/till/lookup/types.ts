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
