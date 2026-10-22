import { sha256 } from "@shopper/utils";
import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand, canonicalJson } from "@shopper/audit";
import { sale, saleLine, saleTender, stockMovement, type ShopperDatabase } from "@shopper/db-pg";
import { decodeSaleEvent, saleSnapshot, type SaleEvent } from "../schemas/till/sale";
import { validateAuthority, validateReferences, type UploadPrincipal } from "./validate";
import { overrideAudit } from "./authority";
import { validateReceipt } from "./receipts";
import { SaleError } from "./error";
import { validateTenders } from "./tenders";
import { saleDocument } from "./document";
import { ensureSaleCustomer } from "../customers/sale";
import { publishCustomer } from "../customers/feed";
import { checkReorder } from "../stock/reorder";
import type { Queue } from "@shopper/ports";

export async function acceptSale(
  db: ShopperDatabase,
  principal: UploadPrincipal,
  raw: unknown,
  proof: string,
  now = Date.now,
  queue?: Queue,
) {
  const event = decodeSaleEvent(raw);
  const occurredAt = new Date(
    Math.min(now(), new Date(event.sale.deviceTime).valueOf() - event.sale.clockOffsetMs),
  );
  const contentHash = await sha256(canonicalJson(event.sale));
  return accept(
    db,
    {
      orgId: principal.orgId,
      deviceId: principal.deviceId,
      branchId: principal.branchId,
      actorId: event.sale.cashierId,
      appVersion: event.sale.appVersion,
      deviceTime: new Date(event.sale.deviceTime),
      queue,
    },
    { principal, event, occurredAt, proofHash: await sha256(proof), contentHash },
  );
}

const accept = defineCommand({
  name: "sale.accept",
  async replay(
    tx,
    ctx,
    input: {
      principal: UploadPrincipal;
      event: SaleEvent;
      proofHash: string;
      contentHash: string;
      occurredAt: Date;
    },
  ) {
    const [saved] = await tx
      .select()
      .from(sale)
      .where(
        and(
          eq(sale.orgId, ctx.orgId),
          eq(sale.deviceId, input.principal.deviceId),
          eq(sale.localId, input.event.sale.localId),
        ),
      );
    if (!saved) return undefined;
    await validateAuthority(
      tx,
      ctx,
      input.principal,
      v.parse(saleSnapshot, saved.payload),
      input.proofHash,
      saved.occurredAt,
    );
    if (saved.contentHash !== input.contentHash)
      throw new SaleError("CONFLICT", "Sale identity already has different content");
    return {
      output: {
        localId: saved.localId,
        occurredAt: saved.occurredAt.toISOString(),
        customerId: saved.customerId,
        customerCreated: false,
      },
    };
  },
  async run(tx, ctx, input) {
    const snapshot = input.event.sale;
    await validateAuthority(tx, ctx, input.principal, snapshot, input.proofHash, input.occurredAt);
    await validateReferences(tx, ctx.orgId, snapshot, input.occurredAt);
    await validateReceipt(tx, snapshot);
    const tenders = await validateTenders(tx, snapshot);
    const buyer = await ensureSaleCustomer(tx, ctx, snapshot);
    const [saved] = await tx
      .insert(sale)
      .values({
        id: snapshot.id,
        orgId: ctx.orgId,
        deviceId: snapshot.deviceId,
        localId: snapshot.localId,
        storeId: snapshot.storeId,
        branchId: snapshot.branchId,
        cashierId: snapshot.cashierId,
        sessionId: snapshot.sessionId,
        appVersion: snapshot.appVersion,
        customerId: buyer.id,
        eventVersion: input.event.v,
        deviceTime: new Date(snapshot.deviceTime),
        occurredAt: input.occurredAt,
        receiptNumber: snapshot.receiptNumber,
        receipt: await saleDocument(tx, snapshot),
        total: snapshot.total,
        cashRounding: snapshot.cashRounding,
        paid: snapshot.paid,
        change: snapshot.change,
        payload: snapshot,
        contentHash: input.contentHash,
      })
      .onConflictDoNothing({ target: [sale.deviceId, sale.localId] })
      .returning();
    if (!saved) throw new SaleError("CONFLICT", "Sale identity already exists");
    await tx.insert(saleLine).values(
      snapshot.lines.map((line) => ({
        id: line.id,
        orgId: ctx.orgId,
        saleId: saved.id,
        productId: line.productId,
        priceId: line.priceId,
        taxRuleId: line.tax.rule.id,
        payload: line,
      })),
    );
    await tx.insert(saleTender).values(tenders);
    await tx.insert(stockMovement).values(
      snapshot.lines.map((line) => ({
        orgId: ctx.orgId,
        branchId: snapshot.branchId,
        productId: line.productId,
        saleId: saved.id,
        saleLineId: line.id,
        reason: "sale" as const,
        quantityThousandths: -line.tax.quantityThousandths,
        occurredAt: input.occurredAt,
      })),
    );
    await checkReorder(
      tx,
      ctx,
      snapshot.branchId,
      snapshot.lines.map((line) => line.productId),
    );
    if (buyer.created) await publishCustomer(tx, ctx.orgId, buyer.created);
    return {
      localId: saved.localId,
      occurredAt: saved.occurredAt.toISOString(),
      customerId: buyer.id,
      customerCreated: Boolean(buyer.created),
    };
  },
  audit: (input, output) => ({ ...output, ...overrideAudit(input.event.sale) }),
  details: (_input, output) => ({ entity: "sale", entityId: output.localId }),
});
