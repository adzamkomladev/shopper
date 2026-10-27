import { sha256 } from "@shopper/utils";
import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand, canonicalJson } from "@shopper/audit";
import {
  fiscalDoc,
  sale,
  saleLine,
  saleTender,
  stockMovement,
  type ShopperDatabase,
} from "@shopper/db-pg";
import { decodeSaleEvent, saleSnapshot, type SaleEvent } from "../schemas/till/sale";
import { validateAuthority, validateReferences, type UploadPrincipal } from "./validate";
import { overrideAudit } from "./authority";
import { validateReceipt } from "./receipts";
import { SaleError } from "./error";
import { validateTenders } from "./tenders";
import { saleDocument } from "./document";
import { ensureSaleCustomer } from "../customers/sale";
import { publishCustomer } from "../customers/feed";
import { consumeHolds } from "../customers/credit/holds";
import { earnPoints } from "../customers/loyalty/ledger";
import { wakeAccount } from "../customers/accounts/wake";
import { checkReorder } from "../stock/reorder";
import type { Queue } from "@shopper/ports";
import { recordFiscalDoc } from "../fiscal/documents";
import { touchStoreDay } from "../reports/rollup";

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
  // A sale without a remote discount approval hashes as before v7, so one accepted then replays as itself.
  const { discountApprovalId, ...unapproved } = event.sale;
  const contentHash = await sha256(canonicalJson(discountApprovalId ? event.sale : unapproved));
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
    const [found] = await tx
      .select({ saved: sale, fiscalDocId: fiscalDoc.id })
      .from(sale)
      .leftJoin(fiscalDoc, and(eq(fiscalDoc.orgId, sale.orgId), eq(fiscalDoc.saleId, sale.id)))
      .where(
        and(
          eq(sale.orgId, ctx.orgId),
          eq(sale.deviceId, input.principal.deviceId),
          eq(sale.localId, input.event.sale.localId),
        ),
      );
    if (!found) return undefined;
    const saved = found.saved;
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
        fiscalDocId: found.fiscalDocId,
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
    const receipt = await saleDocument(tx, snapshot);
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
        receipt,
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
    const fiscalDocId = await recordFiscalDoc(tx, ctx.orgId, receipt, {
      storeId: snapshot.storeId,
      branchId: snapshot.branchId,
      saleId: saved.id,
    });
    await consumeHolds(tx, ctx, snapshot, input.occurredAt);
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
    const earned = await earnPoints(tx, ctx, {
      snapshot,
      customerId: buyer.id,
      occurredAt: input.occurredAt,
    });
    if (buyer.created) await publishCustomer(tx, ctx.orgId, buyer.created);
    // Its charge or earn may bring the account's next interest, expiry or tier notice forward.
    if (buyer.id) wakeAccount(tx, ctx.orgId, buyer.id);
    await touchStoreDay(tx, ctx.orgId, snapshot.storeId, input.occurredAt);
    return {
      localId: saved.localId,
      occurredAt: saved.occurredAt.toISOString(),
      customerId: buyer.id,
      customerCreated: Boolean(buyer.created),
      fiscalDocId,
      ...(earned ? { pointsEarned: earned } : {}),
    };
  },
  audit: (input, output) => ({ ...output, ...overrideAudit(input.event.sale) }),
  details: (_input, output) => ({ entity: "sale", entityId: output.localId }),
});
