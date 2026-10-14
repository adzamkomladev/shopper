export type { TaxClass } from "./types";
import type { Refs } from "./types";
export type { Refs } from "./types";
import { category, supplier, taxClass } from "@shopper/db-pg";

import { eq } from "drizzle-orm";
import type { Queryable } from "../../types";
import type { CleanRow } from "./validate";

/** Existing reference rows by case-insensitive name; categories are keyed by parent too. */

export const chunkSize = 1000;

export function chunks<T>(items: T[]) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) out.push(items.slice(i, i + chunkSize));
  return out;
}
const categoryKey = (parentId: string | null, name: string) =>
  `${parentId ?? ""}|${name.toLowerCase()}`;

export async function loadRefs(db: Queryable, orgId: string): Promise<Refs> {
  // Sequential: one pg client (or transaction) runs one query at a time.
  const tax = await db.select().from(taxClass).where(eq(taxClass.orgId, orgId));
  const categories = await db.select().from(category).where(eq(category.orgId, orgId));
  const suppliers = await db.select().from(supplier).where(eq(supplier.orgId, orgId));
  return {
    tax: new Map(tax.map((t) => [t.code, t.id])),
    categories: new Map(categories.map((c) => [categoryKey(c.parentId, c.name), c.id])),
    suppliers: new Map(suppliers.map((s) => [s.name.toLowerCase(), s.id])),
  };
}

/** Id of the row's category (or department when it has no category); null = none, undefined = not created yet. */
export function categoryOf(refs: Refs, row: CleanRow) {
  const name = row.category ?? row.department;
  if (!name) return null;
  if (!row.category || !row.department) return refs.categories.get(categoryKey(null, name));
  const parent = refs.categories.get(categoryKey(null, row.department));
  return parent && refs.categories.get(categoryKey(parent, name));
}
export const supplierOf = (refs: Refs, row: CleanRow) =>
  row.supplier ? refs.suppliers.get(row.supplier.toLowerCase()) : null;

/** Creates the departments, categories and suppliers the rows name and the org lacks. */
export async function ensureRefs(tx: Queryable, orgId: string, rows: CleanRow[], refs: Refs) {
  const insertCategories = async (
    wanted: Map<string, { name: string; parentId: string | null }>,
  ) => {
    const missing = [...wanted].filter(([key]) => !refs.categories.has(key));
    if (!missing.length) return;
    for (const part of chunks(missing))
      for (const row of await tx
        .insert(category)
        .values(part.map(([, { name, parentId }]) => ({ orgId, name, parentId })))
        .returning())
        refs.categories.set(categoryKey(row.parentId, row.name), row.id);
  };
  const departments = new Map<string, { name: string; parentId: null }>();
  for (const { department } of rows)
    if (department)
      departments.set(categoryKey(null, department), { name: department, parentId: null });
  await insertCategories(departments);

  const nested = new Map<string, { name: string; parentId: string | null }>();
  for (const { department, category: name } of rows) {
    if (!name) continue;
    const parentId = department ? refs.categories.get(categoryKey(null, department))! : null;
    nested.set(categoryKey(parentId, name), { name, parentId });
  }
  await insertCategories(nested);

  const suppliers = new Map<string, string>();
  for (const { supplier: name } of rows)
    if (name && !refs.suppliers.has(name.toLowerCase())) suppliers.set(name.toLowerCase(), name);
  for (const part of chunks([...suppliers.values()]))
    for (const row of await tx
      .insert(supplier)
      .values(part.map((name) => ({ orgId, name })))
      .returning())
      refs.suppliers.set(row.name.toLowerCase(), row.id);
}
