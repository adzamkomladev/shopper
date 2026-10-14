export { recordLocalSale } from "./record";
export type { TillConfig } from "./types";
export { provisionTillReference } from "./reference";
export { TillError } from "./error";

export { issueReceiptBlocks } from "./receipts/blocks";
export { readReceiptStatus } from "./receipts/assign";

export { projectProducts, unprojectProducts, clearProjection } from "./lookup/project";
export type { CatalogueMatch, ProjectedProduct } from "./lookup/types";
export { searchCatalogue, lookupCode } from "./lookup/search";
