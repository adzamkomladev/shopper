import { and, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { canonicalJson, defineCommand, type CommandContext } from "@shopper/audit";
import {
  stockDocument,
  stockMovement,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { sha256 } from "@shopper/utils";
import * as v from "valibot";
import type { UploadPrincipal } from "../sales/types";
import { stockDocumentSchema, type StockDocument } from "../schemas/stock/document";
import { validateProducts, validateStockAuthority } from "./authority";
import { StockError } from "./error";

type Input = {
  principal: UploadPrincipal;
  document: StockDocument;
  proofHash: string;
  contentHash: string;
  occurredAt: Date;
};
type Line = { productId: string; before?: number; counted?: number; delta: number };
type Output = { id: string; kind: StockDocument["kind"]; occurredAt: string; lines: Line[] };

export async function acceptStockDocument(
  db: ShopperDatabase,
  principal: UploadPrincipal,
  raw: unknown,
  proof: string,
  options: { appVersion: string; now?: () => number },
): Promise<Output> {
  const document = v.parse(stockDocumentSchema, raw);
  const at = new Date(document.kind === "count" ? document.countedAt : document.receivedAt);
  const input = {
    principal,
    document,
    occurredAt: new Date(Math.min((options.now ?? Date.now)(), at.valueOf())),
    proofHash: await sha256(proof),
    contentHash: await sha256(canonicalJson(document)),
  };
  const context = {
    orgId: principal.orgId,
    deviceId: principal.deviceId,
    branchId: principal.branchId,
    actorId: document.actorId,
    appVersion: options.appVersion,
  };
  return (document.kind === "count" ? acceptCount : acceptReceipt)(db, context, input);
}

async function replay(tx: ShopperTransaction, ctx: CommandContext, input: Input) {
  const [saved] = await tx
    .select()
    .from(stockDocument)
    .where(and(eq(stockDocument.orgId, ctx.orgId), eq(stockDocument.id, input.document.id)));
  if (!saved) return undefined;
  await validateStockAuthority(
    tx,
    ctx,
    input.principal,
    input.document,
    input.proofHash,
    saved.occurredAt,
  );
  if (saved.contentHash !== input.contentHash || saved.deviceId !== input.principal.deviceId)
    throw new StockError("CONFLICT", "Stock document identity already has different content");
  const moved = await tx
    .select({ productId: stockMovement.productId, delta: stockMovement.quantityThousandths })
    .from(stockMovement)
    .where(and(eq(stockMovement.orgId, ctx.orgId), eq(stockMovement.documentId, saved.id)));
  const deltas = new Map(moved.map((row) => [row.productId, row.delta]));
  return { output: describe(input.document, saved.occurredAt, deltas) };
}

async function post(tx: ShopperTransaction, ctx: CommandContext, input: Input) {
  const { document } = input;
  await validateStockAuthority(
    tx,
    ctx,
    input.principal,
    document,
    input.proofHash,
    input.occurredAt,
  );
  const productIds = document.lines.map((line) => line.productId);
  await validateProducts(tx, ctx.orgId, productIds);
  await tx.insert(stockDocument).values({
    id: document.id,
    orgId: ctx.orgId,
    branchId: input.principal.branchId,
    deviceId: input.principal.deviceId,
    actorId: document.actorId,
    kind: document.kind,
    occurredAt: input.occurredAt,
    contentHash: input.contentHash,
    payload: document,
  });
  const deltas = new Map<string, number>();
  if (document.kind === "receipt")
    for (const line of document.lines) deltas.set(line.productId, line.quantityThousandths);
  else {
    // ponytail: late offline sales dated before countedAt shift this delta, and an older count
    // is rejected whole (SUPERSEDED) once a newer one exists; upgrade with a count-aware on-hand
    // projection that re-bases later counts.
    const [newer] = await tx
      .select({ productId: stockMovement.productId })
      .from(stockMovement)
      .where(
        and(
          eq(stockMovement.orgId, ctx.orgId),
          eq(stockMovement.branchId, input.principal.branchId),
          eq(stockMovement.reason, "count"),
          inArray(stockMovement.productId, productIds),
          gt(stockMovement.occurredAt, input.occurredAt),
        ),
      )
      .limit(1);
    if (newer) throw new StockError("SUPERSEDED", `A newer count exists for ${newer.productId}`);
    const onHand = await tx
      .select({
        productId: stockMovement.productId,
        total: sql<string>`COALESCE(SUM(${stockMovement.quantityThousandths}), 0)`,
      })
      .from(stockMovement)
      .where(
        and(
          eq(stockMovement.orgId, ctx.orgId),
          eq(stockMovement.branchId, input.principal.branchId),
          inArray(stockMovement.productId, productIds),
          lte(stockMovement.occurredAt, input.occurredAt),
        ),
      )
      .groupBy(stockMovement.productId);
    const before = new Map(onHand.map((row) => [row.productId, Number(row.total)]));
    for (const line of document.lines)
      deltas.set(line.productId, line.countedThousandths - (before.get(line.productId) ?? 0));
  }
  const rows = [...deltas].filter(([, delta]) => delta !== 0);
  if (rows.length)
    await tx.insert(stockMovement).values(
      rows.map(([productId, quantityThousandths]) => ({
        orgId: ctx.orgId,
        branchId: input.principal.branchId,
        productId,
        documentId: document.id,
        reason: document.kind,
        quantityThousandths,
        occurredAt: input.occurredAt,
      })),
    );
  return describe(document, input.occurredAt, deltas);
}

function describe(document: StockDocument, occurredAt: Date, deltas: Map<string, number>): Output {
  return {
    id: document.id,
    kind: document.kind,
    occurredAt: occurredAt.toISOString(),
    lines: document.lines.map((line) => {
      const delta = deltas.get(line.productId) ?? 0;
      return "countedThousandths" in line
        ? {
            productId: line.productId,
            before: line.countedThousandths - delta,
            counted: line.countedThousandths,
            delta,
          }
        : { productId: line.productId, delta };
    }),
  };
}

const details = (_input: Input, output: Output) => ({
  entity: "stock_document",
  entityId: output.id,
});
const audit = (_input: Input, output: Output) => ({ ...output });

const acceptCount = defineCommand({
  name: "stock.count.accept",
  replay,
  run: post,
  audit,
  details,
});
const acceptReceipt = defineCommand({
  name: "stock.receipt.accept",
  replay,
  run: post,
  audit,
  details,
});
