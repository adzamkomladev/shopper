import * as v from "valibot";
import { add, money } from "@shopper/money";
import { saleEvent, type SaleSnapshot } from "../../schemas/till/sale";
import type { draftTenderKinds } from "@shopper/db-sqlite";
import { TillError } from "../error";
import type { claimDraft } from "../drafts/edit";
import type { quoteDraft } from "../drafts/quote";
import type { settle } from "../tenders/settle";

type Drafted = Awaited<ReturnType<typeof claimDraft>>;
type Quoted = ReturnType<typeof quoteDraft>;
type Tender = {
  id: string;
  kind: (typeof draftTenderKinds)[number];
  amount: number;
  reference: string | null;
  approvalCode: string | null;
  last4: string | null;
  network: string | null;
};
type Parts = {
  id: string;
  scope: { orgId: string; deviceId: string; branchId: string; cashierId: string };
  config: { storeId: string; appVersion: string };
  sessionId: string;
  deviceTime: Date;
  at: Date;
  receipt: Pick<SaleSnapshot, "receiptNumber" | "receiptOverflow">;
  lines: SaleSnapshot["lines"];
  totals: SaleSnapshot["totals"];
  settlement: ReturnType<typeof settle>;
  tenders: Tender[];
  customer: SaleSnapshot["customer"];
};

/** The draft's lines as sold: the quote's tax snapshot with the discount, price override and label each line carried. */
export function snapshotLines(quoted: Quoted["lines"], drafted: Drafted["lines"]) {
  return quoted.map((line) => {
    if (line.error) throw new TillError(line.error, "Cannot complete an unquotable sale line");
    const source = drafted.find((l) => l.id === line.lineId);
    if (!source) throw new TillError("LINE_UNKNOWN", "Quoted line no longer exists");
    const { lineId, listPrice, ...rest } = line;
    return {
      ...rest,
      id: lineId,
      discount: money(source.discount),
      override:
        listPrice === undefined
          ? null
          : {
              listPrice,
              reason: source.overrideReason ?? "",
              approverId: source.overrideApproverId,
            },
      label:
        source.label?.kind === "price"
          ? {
              kind: "price" as const,
              code: source.label.code,
              originalPriceId: source.label.originalPriceId,
            }
          : source.label
            ? { kind: "weight" as const, code: source.label.code }
            : null,
    };
  });
}

/** The sale.recorded event the outbox uploads and the till keeps. */
export function buildSaleEvent(p: Parts) {
  return v.parse(saleEvent, {
    v: 5,
    type: "sale.recorded",
    sale: {
      id: p.id,
      localId: p.id,
      orgId: p.scope.orgId,
      deviceId: p.scope.deviceId,
      storeId: p.config.storeId,
      branchId: p.scope.branchId,
      cashierId: p.scope.cashierId,
      sessionId: p.sessionId,
      appVersion: p.config.appVersion,
      deviceTime: p.deviceTime.toISOString(),
      ...p.receipt,
      clockOffsetMs: p.deviceTime.valueOf() - p.at.valueOf(),
      lines: p.lines,
      totals: p.totals,
      cashRounding: p.settlement.roundingLine,
      total: p.settlement.total,
      change: p.settlement.change,
      paid: add(p.settlement.cash, p.settlement.nonCash),
      customer: p.customer,
      tenders: p.tenders.map((t) => ({
        id: t.id,
        kind: t.kind,
        amount: t.amount,
        ...(t.reference ? { reference: t.reference } : {}),
        ...(t.approvalCode ? { approvalCode: t.approvalCode } : {}),
        ...(t.last4 ? { last4: t.last4 } : {}),
        ...(t.network ? { network: t.network } : {}),
      })),
    },
  });
}
