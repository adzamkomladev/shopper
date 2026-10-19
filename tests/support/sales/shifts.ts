// Server-side shift fixtures: a Z report the golden world's register could really have uploaded, worked by hand.
//   float 2 000 000; cash sales kept 49 000, cash refunds 13 000, a GHS 100 drop (1 000 000) and a no-sale
//   cash expected 2 000 000 + 49 000 - 13 000 - 1 000 000 = 1 036 000; card 24 000 - 12 000 = 12 000; MoMo 0
//   counted: GHS 100 + 2 + 1 + 0.50 + 0.10 = 1 036 000, card 12 000 typed in, MoMo 0: every variance 0
//   shiftEvent(world, over?)   -> a `shift.closed` event (balanced unless `over` declares something else)
//   edit(event, mutate)        -> a copy of the event with the Z changed by `mutate`
//   refigure(z)                -> recomputes the variances from the tenders' expected and the declared totals
//   postShift(event, proof)    -> POST /sync/shifts as the enrolled device, { status, body }
import { v7 } from "uuid";
import { api } from "../till/server";
import { syncHeaders } from "../till/requests";
import { denominate } from "../till/close";
import type { goldenWorld } from "./golden/setup";

type World = Awaited<ReturnType<typeof goldenWorld>>;
type Tender = "cash" | "card" | "momo";
type Over = {
  id?: string;
  closedAt?: string;
  approverId?: string | null;
  cash?: number;
  card?: number;
  momo?: number;
  actor?: { userId: string; sessionId: string };
};

export const closedAt = "2026-10-15T20:00:00.000Z";
export const threshold = 50_000;
export const expected = { cash: 1_036_000, card: 12_000, momo: 0 };

export function shiftEvent(world: World, over: Over = {}) {
  const { userId, sessionId } = over.actor ?? {
    userId: world.session.userId,
    sessionId: world.session.id,
  };
  const declared = {
    cash: over.cash ?? expected.cash,
    card: over.card ?? expected.card,
    momo: over.momo ?? expected.momo,
  };
  const close = over.closedAt ?? closedAt;
  const tenders = [
    { tender: "cash", sales: 49_000, refunds: 13_000, expected: expected.cash },
    { tender: "card", sales: 24_000, refunds: 12_000, expected: expected.card },
    { tender: "momo", sales: 0, refunds: 0, expected: expected.momo },
  ];
  const report = refigure({
    kind: "z",
    shiftId: over.id ?? v7(),
    storeId: world.config.storeId,
    branchId: world.scope.branchId,
    deviceId: world.scope.deviceId,
    registerName: null,
    appVersion: world.config.appVersion,
    openedAt: "2026-10-15T08:00:00.000Z",
    openedBy: userId,
    at: close,
    sales: { count: 3, gross: 73_000, tax: 12_101 },
    refunds: { count: 2, total: 25_000 },
    tenders,
    cash: {
      float: 2_000_000,
      sales: 49_000,
      refunds: 13_000,
      drops: 1_000_000,
      expected: expected.cash,
    },
    movements: [
      {
        kind: "drop",
        amount: 1_000_000,
        reason: "Safe run",
        actorId: userId,
        at: "2026-10-15T11:00:00.000Z",
      },
      {
        kind: "no_sale",
        amount: 0,
        reason: "Change request",
        actorId: userId,
        at: "2026-10-15T11:30:00.000Z",
      },
    ],
    cashiers: [{ userId, name: "Golden Cashier" }],
    declared: { counts: denominate(declared.cash), ...declared },
    variances: [],
    threshold,
    approverId: over.approverId ?? null,
    closedAt: close,
    closedBy: userId,
    anchor: { seq: 7, hash: "a".repeat(64) },
  });
  return {
    v: 1 as const,
    type: "shift.closed" as const,
    shift: { orgId: world.scope.orgId, sessionId, report },
  };
}

/** The variances as the till would have stated them: declared - expected for each tender. */
export function refigure<T extends { tenders: any[]; declared: any }>(report: T): T {
  const kinds: Tender[] = ["cash", "card", "momo"];
  const variances = kinds.map((tender) => {
    const { expected: owed } = report.tenders.find((row: any) => row.tender === tender);
    const declared = report.declared[tender];
    return { tender, expected: owed, declared, variance: declared - owed };
  });
  return { ...report, variances };
}

export function edit(event: ReturnType<typeof shiftEvent>, mutate: (z: any) => void) {
  const copy = structuredClone(event);
  mutate(copy.shift.report);
  return copy;
}

export async function postShift(event: unknown, proof: string, headers = syncHeaders()) {
  const response = await api.request("/sync/shifts", {
    method: "POST",
    headers,
    body: JSON.stringify({ requestId: v7(), proof, shift: event }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}
