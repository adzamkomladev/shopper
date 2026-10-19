import { v7 } from "uuid";
import { refundPayout } from "@shopper/core/refunds";
import type { SaleSnapshot } from "@shopper/core/schemas";
import { add, money } from "@shopper/money";
import { refundShare } from "@shopper/tax";
import { api } from "../till/server";
import { syncHeaders } from "../till/requests";
import type { goldenWorld } from "./golden/setup";

type World = Awaited<ReturnType<typeof goldenWorld>>;
export type Pick = { line: number; before: number; after: number };
type Options = {
  id?: string;
  reason?: string;
  approverId?: string | null;
  tender?: { kind: "cash" } | { kind: "card" | "momo"; reference: string };
  priorCash?: number;
  rounding?: "none" | "10p";
};

const keys = ["base", "vat", "nhil", "getfund", "covid", "gross", "roundingAdjustment"] as const;

/** A `refund.recorded` event refunding `picks` (quantities `before`..`after` of sale lines) of `sale`. */
export function refundEvent(
  world: World,
  sale: SaleSnapshot,
  picks: Pick[],
  options: Options = {},
  actor: { userId: string; sessionId: string } = {
    userId: world.session.userId,
    sessionId: world.session.id,
  },
) {
  const lines = picks.map(({ line, before, after }) => {
    const original = sale.lines[line]!;
    return {
      id: v7(),
      originalLineId: original.id,
      productId: original.productId,
      name: original.name,
      baseUnit: original.baseUnit,
      tax: refundShare(original.tax, before, after),
    };
  });
  const totals = Object.fromEntries(
    keys.map((key) => [key, lines.reduce((sum, l) => add(sum, l.tax[key]), money(0))]),
  ) as Record<(typeof keys)[number], ReturnType<typeof money>>;
  const tender = options.tender ?? { kind: "card" as const, reference: "CARD-REF-1" };
  const payout = refundPayout({
    kind: tender.kind,
    priorCash: money(options.priorCash ?? 0),
    gross: totals.gross,
    rounding: options.rounding ?? "10p",
  });
  return {
    v: 1 as const,
    type: "refund.recorded" as const,
    refund: {
      id: options.id ?? v7(),
      orgId: sale.orgId,
      deviceId: sale.deviceId,
      storeId: sale.storeId,
      branchId: sale.branchId,
      cashierId: actor.userId,
      sessionId: actor.sessionId,
      appVersion: world.config.appVersion,
      deviceTime: "2026-10-15T12:30:00.000Z",
      clockOffsetMs: 0,
      originalSaleId: sale.id,
      reason: options.reason ?? "Customer returned goods",
      approverId: options.approverId ?? null,
      lines,
      totals,
      cashRounding: payout.cashRounding,
      total: payout.total,
      tender,
    },
  };
}

export async function postRefund(event: unknown, proof: string, headers = syncHeaders()) {
  const response = await api.request("/sync/refunds", {
    method: "POST",
    headers,
    body: JSON.stringify({ requestId: v7(), proof, refund: event }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}
