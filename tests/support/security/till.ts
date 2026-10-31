import { v7 } from "uuid";
import { buildInfo } from "@shopper/config";
import { GENESIS_HASH, hashEntry } from "@shopper/audit";
import type { Body, Session } from "./bodies";

/**
 * A register's uploads, each a real till event that says truthfully it is A's (shop, register, session) and points
 * every reference at B, so the check behind the scope is the one that must refuse it. The audit row claims B's
 * shop outright: a till may only upload its own chain.
 */
export const TILL_BODIES: Record<string, Body> = {
  "POST /sync/handshake": () => ({
    requestId: v7(),
    appVersion: "0.0.0",
    protocol: buildInfo.syncProtocol,
  }),
  "POST /sync/snapshot/signatures": (id) => ({ saleIds: [id], refundIds: [id] }),
  "POST /sync/customers": (id, own) => ({
    requestId: v7(),
    customer: {
      v: 1,
      type: "customer.updated",
      customer: { ...origin(own), id, baseVersion: 1, changes: { name: "Sweep" } },
    },
    proof: own.proof,
  }),
  // A chain row that claims B's shop, correctly hashed: only the shop check can refuse it.
  "POST /sync/audit": async (id) => ({ requestId: v7(), entries: [await foreignEntry(id)] }),
  "POST /sync/stock": (id, own) => ({
    requestId: v7(),
    document: {
      v: 1,
      id: v7(),
      actorId: own.userId,
      sessionId: own.sessionId,
      kind: "receipt",
      lines: [{ productId: id, quantityThousandths: 1000 }],
      receivedAt: new Date().toISOString(),
    },
    proof: own.proof,
  }),
  // B's real session and proof, offered from A's register: only the shop check stands in the way.
  "POST /sync/sessions": (_id, _own, other) => ({
    proof: `${other.proof}.${v7()}`,
    offline: {
      parentSessionId: other.sessionId,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      permissions: ["sale.create"],
    },
  }),
  "POST /sync/refunds": (id, own) => ({
    requestId: v7(),
    refund: { v: 4, type: "refund.recorded", refund: refund(id, own) },
    proof: own.proof,
  }),
  "POST /sync/customers/holds": (id, own) => ({
    requestId: v7(),
    hold: {
      id: v7(),
      orgId: own.orgId,
      sessionId: own.sessionId,
      customerId: id,
      kind: "credit",
      amount: 1000,
    },
    proof: own.proof,
  }),
  "POST /sync/customers/holds/:id/release": (id, own) => ({
    requestId: v7(),
    release: { orgId: own.orgId, sessionId: own.sessionId },
    proof: own.proof,
  }),
  "POST /sync/customers/:id/account": (id, own) => ({
    session: { orgId: own.orgId, sessionId: own.sessionId },
    proof: own.proof,
  }),
  "POST /sync/accounts/payments": (id, own) => ({
    requestId: v7(),
    payment: {
      v: 1,
      type: "account.payment",
      payment: {
        ...origin(own),
        id: v7(),
        customerId: id,
        shiftId: id,
        method: "cash",
        amount: 1000,
        reference: null,
      },
    },
    proof: own.proof,
  }),
  "POST /sync/receipts": (id) => ({ saleId: id, size: 1, sha256: "0".repeat(64) }),
};

/** What a till event says about where it came from: its own shop and session. */
const origin = (own: Session) => ({
  orgId: own.orgId,
  sessionId: own.sessionId,
  occurredAt: new Date().toISOString(),
});
const zero = { base: 0, vat: 0, nhil: 0, getfund: 0, covid: 0, gross: 0, roundingAdjustment: 0 };

/** A refund of the other shop's sale, every reference B's, in the shape a register uploads. */
function refund(id: string, own: Session) {
  return {
    id: v7(),
    orgId: own.orgId,
    deviceId: own.deviceId,
    storeId: own.storeId,
    branchId: own.branchId,
    cashierId: own.userId,
    sessionId: own.sessionId,
    appVersion: buildInfo.version,
    deviceTime: new Date().toISOString(),
    clockOffsetMs: 0,
    originalSaleId: id,
    creditNoteNumber: null,
    reason: "Sweep",
    approverId: null,
    approvalId: null,
    lines: [
      {
        id: v7(),
        originalLineId: id,
        productId: id,
        name: "Sweep",
        baseUnit: "each",
        tax: {
          ...zero,
          rule: {
            id: v7(),
            effectiveFrom: "2026-01-01",
            vatBps: 1500,
            nhilBps: 250,
            getfundBps: 250,
            covidBps: 0,
          },
          on: "2026-01-01",
          taxClass: "standard",
          priceMode: "inclusive",
          registered: true,
          quantityThousandths: 1000,
          unitPrice: 0,
          discount: 0,
        },
      },
    ],
    totals: zero,
    cashRounding: 0,
    total: 0,
    accountCredit: 0,
    pointsReturned: 0,
    pointsValue: 0,
    tender: { kind: "cash" },
  };
}

/** The first row of a register's chain, written as if in B's shop. */
async function foreignEntry(id: string) {
  const at = new Date().toISOString();
  const entry = {
    id: v7(),
    orgId: id,
    actorId: id,
    role: "cashier",
    deviceId: id,
    branchId: id,
    approverId: null,
    reason: null,
    deviceTime: at,
    entity: "sale",
    entityId: id,
    before: null,
    after: null,
    appVersion: buildInfo.version,
    command: "sale.record",
    payload: {},
    chainSeq: 1,
    prevHash: GENESIS_HASH,
    createdAt: at,
    updatedAt: at,
  };
  // The chain hashes its timestamps as dates; the upload carries them as text.
  const dated = {
    ...entry,
    deviceTime: new Date(at),
    createdAt: new Date(at),
    updatedAt: new Date(at),
  };
  return { ...entry, hash: await hashEntry({ ...dated, hash: null } as never) };
}
