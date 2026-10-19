// Helpers for the unpaid-draft suites. API under test (all from @shopper/core/till, `at` = corrected till time):
//   readDraft(db, scope, { at })                         -> DraftView (read-only, requotes)
//   addToDraft(db, ctx, { scope, expectedRevision, at, code? | productId?, quantityThousandths? })
//   setDraftQuantity(db, ctx, { scope, expectedRevision, at, lineId, quantityThousandths })
//   removeDraftLine(db, ctx, { scope, expectedRevision, at, lineId })
//   validateSession(db, session, { scope: {orgId, deviceId, branchId}, permission, at }) -> DraftScope
// DraftView = { draft: null | { id, revision, lines: [{ id, productId, quantityThousandths, label? }], createdAt, updatedAt },
//               quote: { lines: [{ lineId, ...quoteLine fields }], totals: SaleTotals, changed: boolean } }
// A missing draft reads as revision 0 (`draft: null`); the first add expects revision 0. A scope that does not match
// the command context is TillError "scope"; a stale expectedRevision is TillError "REVISION_STALE".
import { asc } from "drizzle-orm";
import { expect } from "vite-plus/test";
import { verifyChain, type AuditEntry } from "@shopper/audit";
import { localSale, outbox, saleLine, tillAudit, tillState, hostSession } from "@shopper/db-sqlite";
import type { TillDatabase } from "@shopper/db-sqlite";
import { addToDraft, readDraft } from "@shopper/core/till";
import { at, context, ids, label, layout, refPrice, refProduct, seed } from "./basket";
import { insertOpenShift } from "./shifts";

export { at, context, fails, ids, withTill } from "./basket";
export { label, session } from "./basket";
export { withDatabase } from "./sales";

type Scope = { orgId: string; deviceId: string; branchId: string; cashierId: string };
export const scope: Scope = {
  orgId: ids.org,
  deviceId: ids.device,
  branchId: ids.branch,
  cashierId: ids.cashier,
};
export const otherCashier = "019a0000-0000-7000-8000-0000000000c1";
export const otherDevice = "019a0000-0000-7000-8000-0000000000d1";
export const otherBranch = "019a0000-0000-7000-8000-0000000000b1";
export const asScope = (over: Partial<Scope>) => ({ ...scope, ...over });
export const ctxFor = (s: Scope) => ({
  ...context,
  orgId: s.orgId,
  actorId: s.cashierId,
  deviceId: s.deviceId,
  branchId: s.branchId,
});
export const uuid7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const zeroTotals = {
  base: 0,
  vat: 0,
  nhil: 0,
  getfund: 0,
  covid: 0,
  gross: 0,
  roundingAdjustment: 0,
};

// Ordinary product: 12 000 per unit; each pack barcode carries its quantity.
export const bare = "5012345678900";
export const pack = "5012345678917";
// Weight product (kg) at 30 000 per kg; embedded labels use product code 00123.
export const weightLabel = label(21, "00123", "00500"); // 500 g  -> 500 thousandths of a kg
export const priceLabel = label(22, "00123", "00100"); // 1.00 GHS -> gross 10 000, quantity 333
export const products = {
  ordinary: refProduct({
    barcodes: [
      { code: bare, quantityThousandths: 1000 },
      { code: pack, quantityThousandths: 6000 },
    ],
  }),
  weighed: refProduct({
    baseUnit: "kg",
    barcodes: [{ code: "00123", quantityThousandths: 1000 }],
  }),
};

/**
 * Seeds golden tax rules, the two products, both label layouts and a till_state row with receipt allocation, and
 * opens a shift directly (no audit row) so the register may sell. `{ shift: false }` leaves the register closed.
 */
export async function world(db: TillDatabase, options: { shift?: boolean } = {}) {
  await seed(db, {
    products: Object.values(products),
    prices: [refPrice(products.ordinary.id, 12_000), refPrice(products.weighed.id, 30_000)],
    mappings: [
      layout({ prefix: 21 }),
      layout({ prefix: 22, kind: "price", unit: undefined, decimals: 2 }),
    ],
  });
  await db.transaction((tx) =>
    tx.insert(tillState).values({
      id: "019a0000-0000-7000-8000-0000000000e1",
      orgId: ids.org,
      deviceId: ids.device,
      lastOutboxSeq: 3,
      receiptLastUsed: 7,
      receiptBlocks: [{ start: 1, end: 100 }],
    }),
  );
  if (options.shift !== false) await insertOpenShift(db);
}

export const ctx = ctxFor(scope);
export const add = (
  db: TillDatabase,
  expectedRevision: number,
  input: { code?: string; productId?: string; quantityThousandths?: number } = {},
  over: { scope?: Scope; at?: Date } = {},
) =>
  addToDraft(db, ctxFor(over.scope ?? scope), {
    scope: over.scope ?? scope,
    expectedRevision,
    at: over.at ?? at,
    ...input,
  });
export const read = (db: TillDatabase, s = scope, time = at) => readDraft(db, s, { at: time });

/** Every row a basket edit must leave alone: sales, lines, outbox, host sessions and till_state (receipt allocation). */
export const untouched = (db: TillDatabase) =>
  db.read(async (tx) => ({
    sales: await tx.select().from(localSale),
    lines: await tx.select().from(saleLine),
    outbox: await tx.select().from(outbox),
    sessions: await tx.select().from(hostSession),
    state: await tx.select().from(tillState),
  }));

export const auditRows = (db: TillDatabase) =>
  db.read((tx) => tx.select().from(tillAudit).orderBy(asc(tillAudit.chainSeq)));
export async function expectChain(db: TillDatabase) {
  const rows = await auditRows(db);
  expect(await verifyChain(rows as AuditEntry[])).toMatchObject({
    valid: true,
    count: rows.length,
  });
  return rows;
}
export const draftAudit = async (db: TillDatabase) =>
  (await auditRows(db)).filter((row) => row.command.startsWith("till.draft."));
