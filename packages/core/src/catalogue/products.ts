import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { product, productBarcode } from "@shopper/db-pg";
import { managementJson, ManagementError } from "../management";
import { loadProduct } from "./product-reads";
import { barcodeInput, productInput, productPatch } from "../schemas/catalogue";
import { nonEmpty, recordId, taxClassId } from "./records";

const productDetails = (
  _input: unknown,
  result: { id: string; before: unknown; after: unknown },
) => ({ entity: "product", entityId: result.id, before: result.before, after: result.after });

export const createProduct = defineCommand({
  name: "product.create",
  async run(tx, context, input: unknown) {
    const { taxClass, barcodes, ...data } = v.parse(productInput, input);
    const [row] = await tx
      .insert(product)
      .values({
        ...data,
        orgId: context.orgId,
        taxClassId: await taxClassId(tx, context.orgId, taxClass),
      })
      .returning({ id: product.id });
    if (barcodes.length)
      await tx
        .insert(productBarcode)
        .values(
          barcodes.map((barcode) => ({ ...barcode, orgId: context.orgId, productId: row!.id })),
        );
    const after = await loadProduct(tx, context.orgId, row!.id);
    return { id: row!.id, before: null, after: { ...after, barcodes } };
  },
  audit: (_input, result) => ({ productId: result.id }),
  details: productDetails,
});

export const updateProduct = defineCommand({
  name: "product.update",
  async run(tx, context, input: { id: string; data: unknown }) {
    const id = recordId(input.id);
    const { taxClass, ...data } = nonEmpty(v.parse(productPatch, input.data));
    const before = await loadProduct(tx, context.orgId, id, true);
    if (!before) throw new ManagementError("Record not found");
    await tx
      .update(product)
      .set({
        ...data,
        ...(taxClass ? { taxClassId: await taxClassId(tx, context.orgId, taxClass) } : {}),
      })
      .where(and(eq(product.orgId, context.orgId), eq(product.id, id)));
    return { id, before, after: await loadProduct(tx, context.orgId, id) };
  },
  audit: (_input, result) => ({ productId: result.id }),
  details: productDetails,
});

/** Archiving hides a product from search and scans; its history stays readable. */
export const archiveProduct = defineCommand({
  name: "product.archive",
  async run(tx, context, input: { id: string }) {
    const id = recordId(input.id);
    const before = await loadProduct(tx, context.orgId, id, true);
    if (!before) throw new ManagementError("Record not found");
    if (!before.archivedAt)
      await tx
        .update(product)
        .set({ archivedAt: new Date() })
        .where(and(eq(product.orgId, context.orgId), eq(product.id, id)));
    return { id, before, after: await loadProduct(tx, context.orgId, id) };
  },
  audit: (_input, result) => ({ productId: result.id }),
  details: productDetails,
});

export const addBarcode = defineCommand({
  name: "barcode.add",
  async run(tx, context, input: { productId: string; data: unknown }) {
    const productId = recordId(input.productId);
    const data = v.parse(barcodeInput, input.data);
    if (!(await loadProduct(tx, context.orgId, productId, true)))
      throw new ManagementError("Record not found");
    const [row] = await tx
      .insert(productBarcode)
      .values({ ...data, orgId: context.orgId, productId })
      .returning();
    return managementJson({ id: row!.id, after: { productId, ...data } });
  },
  audit: (input, result) => ({ productId: input.productId, barcodeId: result.id }),
  details: (_input, result) => ({
    entity: "product_barcode",
    entityId: result.id,
    before: null,
    after: result.after,
  }),
});

export const removeBarcode = defineCommand({
  name: "barcode.remove",
  async run(tx, context, input: { productId: string; code: string }) {
    const productId = recordId(input.productId);
    const [row] = await tx
      .select()
      .from(productBarcode)
      .where(
        and(
          eq(productBarcode.orgId, context.orgId),
          eq(productBarcode.productId, productId),
          eq(productBarcode.code, input.code),
        ),
      )
      .for("update");
    if (!row) throw new ManagementError("Record not found");
    await tx.delete(productBarcode).where(eq(productBarcode.id, row.id));
    return managementJson({
      id: row.id,
      before: { productId, code: row.code, quantityThousandths: row.quantityThousandths },
    });
  },
  audit: (input, result) => ({ productId: input.productId, barcodeId: result.id }),
  details: (_input, result) => ({
    entity: "product_barcode",
    entityId: result.id,
    before: result.before,
    after: null,
  }),
});
