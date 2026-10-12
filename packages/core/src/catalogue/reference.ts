import * as v from "valibot";
import { and, asc, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { category, supplier } from "@shopper/db-pg";
import { managementJson, ManagementError } from "../management";
import { categoryInput, supplierInput } from "../schemas/catalogue/inputs";
import type { Queryable } from "../types";
import { nonEmpty, recordId } from "./records";

export const saveCategory = defineSave("category", category, categoryInput);
export const saveSupplier = defineSave("supplier", supplier, supplierInput);

export const listCategories = (db: Queryable, orgId: string) =>
  db.select().from(category).where(eq(category.orgId, orgId)).orderBy(asc(category.name));
export const listSuppliers = (db: Queryable, orgId: string) =>
  db.select().from(supplier).where(eq(supplier.orgId, orgId)).orderBy(asc(supplier.name));

// Categories are two levels: department, then category. That also rules out cycles.
async function assertDepartment(tx: Queryable, orgId: string, parentId?: string | null) {
  if (!parentId) return;
  const [parent] = await tx
    .select({ parentId: category.parentId })
    .from(category)
    .where(and(eq(category.orgId, orgId), eq(category.id, parentId)));
  if (!parent) throw new ManagementError("Parent category not found", 400);
  if (parent.parentId) throw new ManagementError("Categories nest one level only", 400);
}

/** Creates (no id) or updates (id plus a partial body) a reference row, with before and after audited. */
function defineSave(
  entity: "category" | "supplier",
  table: typeof category | typeof supplier,
  create: typeof categoryInput | typeof supplierInput,
) {
  return defineCommand({
    name: `${entity}.save`,
    async run(tx, context, input: { id?: string; data: unknown }) {
      if (input.id === undefined) {
        const data = v.parse(create, input.data);
        if ("parentId" in data) await assertDepartment(tx, context.orgId, data.parentId);
        const [after] = await tx
          .insert(table)
          .values({ ...data, orgId: context.orgId })
          .returning();
        return managementJson({ id: after!.id, before: null, after });
      }
      const id = recordId(input.id);
      const data = nonEmpty(v.parse(v.partial(create), input.data));
      if ("parentId" in data && data.parentId) {
        if (data.parentId.toLowerCase() === id)
          throw new ManagementError("A category cannot be its own parent", 400);
        await assertDepartment(tx, context.orgId, data.parentId);
        const [child] = await tx
          .select({ id: category.id })
          .from(category)
          .where(and(eq(category.orgId, context.orgId), eq(category.parentId, id)))
          .limit(1);
        if (child)
          throw new ManagementError("A category with sub-categories must stay top-level", 400);
      }
      const where = and(eq(table.orgId, context.orgId), eq(table.id, id));
      const [before] = await tx.select().from(table).where(where).for("update");
      if (!before) throw new ManagementError("Record not found");
      const [after] = await tx.update(table).set(data).where(where).returning();
      return managementJson({ id, before, after });
    },
    audit: (_input, result) => ({ [`${entity}Id`]: result.id }),
    details: (_input, result) => ({
      entity,
      entityId: result.id,
      before: result.before,
      after: result.after,
    }),
  });
}
