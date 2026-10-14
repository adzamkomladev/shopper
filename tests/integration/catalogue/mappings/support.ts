// Shared builders for the embedded barcode mapping suites (EAN-13 digit indexes 2..11 carry the data).
import { expect } from "vite-plus/test";
import { call } from "../support";

export const ghost = "0198d0a0-0000-7000-8000-000000000000";

/** A valid weight layout: five product digits (2..6), five weight digits (7..11), in grams. */
export const weight = (over: Record<string, unknown> = {}) => ({
  prefix: 21,
  product: { start: 2, length: 5 },
  value: { start: 7, length: 5 },
  kind: "weight",
  unit: "g",
  decimals: 0,
  ...over,
});

/** A valid price layout: four product digits (2..5), six price digits (6..11), two decimals. */
export const price = (over: Record<string, unknown> = {}) => ({
  prefix: 22,
  product: { start: 2, length: 4 },
  value: { start: 6, length: 6 },
  kind: "price",
  decimals: 2,
  ...over,
});

export type Mapping = { id: string; prefix: number } & Record<string, unknown>;

export async function listMappings(role = "superadmin") {
  const response = await call("/catalogue/barcodes/mappings", "GET", undefined, role);
  expect(response.status, "GET /catalogue/barcodes/mappings").toBe(200);
  return (await response.json()) as Mapping[];
}

/** Only ten prefixes exist per organisation, so route suites start each test from an empty list. */
export async function clearMappings() {
  for (const { id } of await listMappings()) {
    const removed = await call(`/catalogue/barcodes/mappings/${id}`, "DELETE");
    expect(removed.status, "DELETE /catalogue/barcodes/mappings/:id").toBe(204);
  }
}

export async function createMapping(body: unknown = weight(), role = "superadmin") {
  const response = await call("/catalogue/barcodes/mappings", "POST", body, role);
  expect(response.status, "POST /catalogue/barcodes/mappings").toBe(201);
  return (await response.json()) as Mapping;
}
