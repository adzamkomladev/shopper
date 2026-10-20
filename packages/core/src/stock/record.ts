import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import { canonicalJson, defineCommand, type CommandContext } from "@shopper/audit";
import {
  adjustmentCauses,
  branch,
  stockDocument,
  stockMovement,
  supplier,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { money } from "@shopper/money";
import { sha256 } from "@shopper/utils";
import {
  adjustmentInput,
  receiptInput,
  type AdjustmentInput,
  type ReceiptInput,
} from "../schemas/stock/portal";
import { validateProducts } from "./authority";
import { StockError } from "./error";

type Recorded = { id: string; replayed: boolean };
type Draft = {
  id: string;
  kind: "receipt" | "adjustment";
  branchId: string;
  supplierId?: string;
  cause?: (typeof adjustmentCauses)[number];
  occurredAt: Date;
  /** The validated request; its canonical JSON is the replay identity. */
  request: { lines: { productId: string }[] };
  movements: { productId: string; quantityThousandths: number; unitCost?: number }[];
};

/** The document already saved under this id, if any; the same id with other content is a CONFLICT. */
async function findReplay(
  tx: ShopperTransaction,
  ctx: CommandContext,
  id: string,
  kind: Draft["kind"],
  request: object,
): Promise<{ output: Recorded } | undefined> {
  const [saved] = await tx
    .select()
    .from(stockDocument)
    .where(and(eq(stockDocument.orgId, ctx.orgId), eq(stockDocument.id, id)));
  if (!saved) return undefined;
  if (saved.contentHash !== (await sha256(canonicalJson(request))) || saved.kind !== kind)
    throw new StockError("CONFLICT", "Stock document identity already has different content");
  return { output: { id, replayed: true } };
}

/** Writes one back-office stock document and its movements. */
async function recordDocument(tx: ShopperTransaction, ctx: CommandContext, draft: Draft) {
  const [site] = await tx
    .select({ id: branch.id })
    .from(branch)
    .where(and(eq(branch.orgId, ctx.orgId), eq(branch.id, draft.branchId)));
  if (!site) throw new StockError("INVALID_REFERENCE", "Unknown branch");
  if (draft.supplierId) {
    const [known] = await tx
      .select({ id: supplier.id })
      .from(supplier)
      .where(and(eq(supplier.orgId, ctx.orgId), eq(supplier.id, draft.supplierId)));
    if (!known) throw new StockError("INVALID_REFERENCE", "Unknown supplier");
  }
  await validateProducts(
    tx,
    ctx.orgId,
    draft.request.lines.map((line) => line.productId),
  );
  await tx.insert(stockDocument).values({
    id: draft.id,
    orgId: ctx.orgId,
    branchId: draft.branchId,
    supplierId: draft.supplierId,
    cause: draft.cause,
    actorId: ctx.actorId!,
    kind: draft.kind,
    occurredAt: draft.occurredAt,
    contentHash: await sha256(canonicalJson(draft.request)),
    payload: draft.request,
  });
  await tx.insert(stockMovement).values(
    draft.movements.map((line) => ({
      orgId: ctx.orgId,
      branchId: draft.branchId,
      productId: line.productId,
      documentId: draft.id,
      reason: draft.kind,
      quantityThousandths: line.quantityThousandths,
      unitCost: line.unitCost === undefined ? undefined : money(line.unitCost),
      occurredAt: draft.occurredAt,
    })),
  );
  return { id: draft.id, replayed: false };
}

type ReceiveInput = { receipt: ReceiptInput; now: Date };

/** Goods received from a supplier, with the cost of one base unit per line. */
export const receiveStock = defineCommand({
  name: "stock.receipt.record",
  replay: (tx, ctx, input: ReceiveInput) => {
    const receipt = v.parse(receiptInput, input.receipt);
    return findReplay(tx, ctx, receipt.id, "receipt", receipt);
  },
  async run(tx, ctx, input: ReceiveInput): Promise<Recorded> {
    const receipt = v.parse(receiptInput, input.receipt);
    return recordDocument(tx, ctx, {
      id: receipt.id,
      kind: "receipt",
      branchId: receipt.branchId,
      supplierId: receipt.supplierId,
      occurredAt: input.now,
      request: receipt,
      movements: receipt.lines,
    });
  },
  audit: (input, output) => ({ ...output, ...v.parse(receiptInput, input.receipt) }),
  details: (_input, output) => ({ entity: "stock_document", entityId: output.id }),
});

const fixedSigns = { damaged: -1, expired: -1, theft: -1, found: 1 } as const;

/** damaged, expired and theft remove stock and found adds it; "other" must say which way. */
function adjustmentSign({ cause, direction }: AdjustmentInput) {
  const sign = cause === "other" ? undefined : fixedSigns[cause];
  const wanted = direction === undefined ? undefined : direction === "add" ? 1 : -1;
  if (
    (sign ?? wanted) === undefined ||
    (sign !== undefined && wanted !== undefined && sign !== wanted)
  )
    throw new StockError(
      "INVALID_SIGN",
      `A ${cause} adjustment ${direction ? `cannot ${direction}` : "needs a direction"} stock`,
    );
  return (sign ?? wanted)!;
}

type AdjustInput = { adjustment: AdjustmentInput; now: Date };

/** Wastage, theft, found stock or another correction, with its cause on the record. */
export const adjustStock = defineCommand({
  name: "stock.adjustment.record",
  replay: (tx, ctx, input: AdjustInput) => {
    const adjustment = v.parse(adjustmentInput, input.adjustment);
    return findReplay(tx, ctx, adjustment.id, "adjustment", adjustment);
  },
  async run(tx, ctx, input: AdjustInput): Promise<Recorded> {
    const adjustment = v.parse(adjustmentInput, input.adjustment);
    const sign = adjustmentSign(adjustment);
    return recordDocument(tx, ctx, {
      id: adjustment.id,
      kind: "adjustment",
      branchId: adjustment.branchId,
      cause: adjustment.cause,
      occurredAt: input.now,
      request: adjustment,
      movements: adjustment.lines.map((line) => ({
        productId: line.productId,
        quantityThousandths: sign * line.quantityThousandths,
      })),
    });
  },
  audit: (input, output) => ({ ...output, ...v.parse(adjustmentInput, input.adjustment) }),
  details: (_input, output) => ({ entity: "stock_document", entityId: output.id }),
});
