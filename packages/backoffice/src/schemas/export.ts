import * as v from "valibot";

export const entityName = v.picklist([
  "products",
  "prices",
  "customers",
  "sales",
  "lines",
  "tenders",
  "stock",
  "tax",
  "audit",
]);
export type EntityName = v.InferOutput<typeof entityName>;

export const entityList = v.array(v.object({ name: entityName, ranged: v.boolean() }));

export const archiveRow = v.object({
  id: v.string(),
  status: v.picklist(["running", "ready", "failed"]),
  requestedBy: v.nullable(v.string()),
  createdAt: v.string(),
  completedAt: v.nullable(v.string()),
  files: v.number(),
  rows: v.number(),
  bytes: v.number(),
  missingBlobs: v.number(),
  error: v.nullable(v.string()),
});
export type ArchiveRow = v.InferOutput<typeof archiveRow>;

/** What starting or deleting an archive answers with. */
export const started = v.object({ id: v.string() });

export const archiveList = v.object({
  archives: v.array(archiveRow),
  fingerprint: v.nullable(v.string()),
});

/** What each entity is called on the screen, and what a row of it is. */
export const ENTITY_LABELS: Record<EntityName, { title: string; hint: string }> = {
  products: { title: "Products", hint: "SKU, name, category, supplier, tax class and unit." },
  prices: { title: "Prices", hint: "Every price, per branch, with the dates it was in force." },
  customers: { title: "Customers", hint: "Contact details and credit limits." },
  sales: { title: "Sales", hint: "One row per receipt in the dates you choose." },
  lines: { title: "Sale lines", hint: "One row per item sold, with its tax worked out." },
  tenders: { title: "Payments", hint: "One row per payment taken: cash, card, mobile money." },
  stock: { title: "Stock on hand", hint: "What is on the shelf now, per branch and product." },
  tax: { title: "Tax rules", hint: "The VAT and levy rates and the dates they started." },
  audit: { title: "Audit trail", hint: "Who did what, and when, in the dates you choose." },
};
