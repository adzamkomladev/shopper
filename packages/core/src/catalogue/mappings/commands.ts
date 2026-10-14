import * as v from "valibot";
import { and, eq, ne } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { barcodeMapping } from "@shopper/db-pg";
import { affectedStores, deleted, recordChanges, type Change } from "../../changes";
import { ManagementError } from "../../management";
import { mappingInput, mappingPatch, type MappingInput } from "../../schemas/catalogue/mappings";
import type { Queryable } from "../../types";
import { nonEmpty, recordId } from "../records";
import { mappingView } from "./queries";

const columns = (m: MappingInput) => ({
  prefix: m.prefix,
  productStart: m.product.start,
  productLength: m.product.length,
  valueStart: m.value.start,
  valueLength: m.value.length,
  kind: m.kind,
  unit: m.kind === "weight" ? m.unit : null,
  decimals: m.decimals,
});
const upsert = (view: ReturnType<typeof mappingView>): Change => ({
  entity: "barcode-mapping",
  entityId: view.id,
  op: "upsert",
  payload: view,
});
const owned = (orgId: string, id: string) =>
  and(eq(barcodeMapping.orgId, orgId), eq(barcodeMapping.id, id));

async function assertFree(tx: Queryable, orgId: string, prefix: number, exceptId?: string) {
  const [taken] = await tx
    .select({ id: barcodeMapping.id })
    .from(barcodeMapping)
    .where(
      and(
        eq(barcodeMapping.orgId, orgId),
        eq(barcodeMapping.prefix, prefix),
        exceptId ? ne(barcodeMapping.id, exceptId) : undefined,
      ),
    );
  if (taken) throw new ManagementError("Prefix is already mapped", 409);
}

async function lock(tx: Queryable, orgId: string, id: string) {
  const [row] = await tx.select().from(barcodeMapping).where(owned(orgId, id)).for("update");
  if (!row) throw new ManagementError("Record not found");
  return row;
}

const details = (_input: unknown, r: { id: string; before: unknown; after: unknown }) => ({
  entity: "barcode-mapping",
  entityId: r.id,
  before: r.before,
  after: r.after,
});

const createCommand = defineCommand({
  name: "barcode-mapping.create",
  async run(tx, context, input: unknown) {
    const data = v.parse(mappingInput, input);
    await assertFree(tx, context.orgId, data.prefix);
    const [row] = await tx
      .insert(barcodeMapping)
      .values({ ...columns(data), orgId: context.orgId })
      .returning();
    const after = mappingView(row!);
    await recordChanges(
      tx,
      context.orgId,
      [upsert(after)],
      await affectedStores(tx, context.orgId),
    );
    return { id: after.id, before: null, after };
  },
  audit: (_input, r) => ({ barcodeMappingId: r.id }),
  details,
});

const updateCommand = defineCommand({
  name: "barcode-mapping.update",
  async run(tx, context, input: { id: string; data: unknown }) {
    const id = recordId(input.id);
    const patch = nonEmpty(v.parse(mappingPatch, input.data));
    const before = mappingView(await lock(tx, context.orgId, id));
    const { id: _id, ...current } = before;
    // A price layout has no unit, so switching kind without one drops the old unit.
    const base = patch.kind === "price" && !patch.unit ? { ...current, unit: undefined } : current;
    const data = v.parse(mappingInput, { ...base, ...patch });
    await assertFree(tx, context.orgId, data.prefix, id);
    const [row] = await tx
      .update(barcodeMapping)
      .set(columns(data))
      .where(owned(context.orgId, id))
      .returning();
    const after = mappingView(row!);
    await recordChanges(
      tx,
      context.orgId,
      [upsert(after)],
      await affectedStores(tx, context.orgId),
    );
    return { id, before, after };
  },
  audit: (_input, r) => ({ barcodeMappingId: r.id }),
  details,
});

const deleteCommand = defineCommand({
  name: "barcode-mapping.delete",
  async run(tx, context, input: { id: string }) {
    const id = recordId(input.id);
    const before = mappingView(await lock(tx, context.orgId, id));
    await tx.delete(barcodeMapping).where(owned(context.orgId, id));
    await recordChanges(
      tx,
      context.orgId,
      [deleted("barcode-mapping", id)],
      await affectedStores(tx, context.orgId),
    );
    return { id, before, after: null };
  },
  audit: (_input, r) => ({ barcodeMappingId: r.id }),
  details,
});

// The commands audit before and after; callers get the resulting layout.
export const createBarcodeMapping = async (...args: Parameters<typeof createCommand>) =>
  (await createCommand(...args)).after;
export const updateBarcodeMapping = async (...args: Parameters<typeof updateCommand>) =>
  (await updateCommand(...args)).after;
export const deleteBarcodeMapping = async (...args: Parameters<typeof deleteCommand>) => {
  await deleteCommand(...args);
};
