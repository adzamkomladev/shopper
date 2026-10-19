// Core-level helpers for the till refund suites: a sale made at a given time, and a refund of it.
//   sell(db, time, quantityThousandths = 3000, kind = "cash") -> SaleSnapshot (ordinary product, 12 000 a unit)
//   refund(db, sale, [[lineIndex, quantityThousandths]], over?) -> { event, receipt } from recordRefund
import { sql } from "drizzle-orm";
import {
  addDraftTender,
  completeDraftSale,
  readRegisterSettings,
  recordRefund,
  saveRegisterSettings,
} from "@shopper/core/till";
import type { SaleSnapshot } from "@shopper/core/schemas";
import { refund as refundTable, stockMovement, type TillDatabase } from "@shopper/db-sqlite";
import { config } from "./basket";
import { add, ctx, products, scope, session } from "./drafts";

export { fails } from "./drafts";

/** Valid for every day the suites trade on, and allowed to sell and to ask for refunds. */
export const clerk = {
  ...session,
  roleName: "Cashier",
  issuedAt: "2025-10-01T00:00:00.000Z",
  expiresAt: "2026-01-02T00:00:00.000Z",
  permissions: ["sale.create", "refund.request", "register.settings"],
};
export const trade = (day: string) => ({ from: day, to: day });
export const refundNow = "2025-12-31T23:30:00.000Z";

export async function sell(db: TillDatabase, time: string, quantity = 3_000, kind = "cash") {
  const at = new Date(time);
  const view = await add(
    db,
    0,
    { productId: products.ordinary.id, quantityThousandths: quantity },
    { at },
  );
  await addDraftTender(db, ctx, {
    scope,
    expectedRevision: view.draft?.revision ?? 0,
    at,
    kind,
    amount: view.quote.totals.gross,
    ...(kind === "card" ? { approvalCode: "AB1234", last4: "4242" } : {}),
  });
  const event = await completeDraftSale(db, { ...config, now: () => at }, clerk, {
    scope,
    expectedRevision: (view.draft?.revision ?? 0) + 1,
    at,
  });
  return event.sale as SaleSnapshot;
}

type Over = {
  at?: string;
  tender?: { kind: "cash" } | { kind: "card" | "momo"; reference: string };
  approverId?: string;
  reason?: string;
  permissions?: string[];
  [extra: string]: unknown;
};

export function refund(
  db: TillDatabase,
  sale: SaleSnapshot,
  picks: [number, number][],
  over: Over = {},
) {
  const { at = refundNow, permissions, ...rest } = over;
  return recordRefund(
    db,
    { ...config, now: () => new Date(at) },
    { ...clerk, permissions: permissions ?? clerk.permissions },
    {
      at: new Date(at),
      saleId: sale.id,
      lines: picks.map(([line, quantityThousandths]) => ({
        lineId: sale.lines[line]!.id,
        quantityThousandths,
      })),
      reason: "Damaged",
      tender: { kind: "cash" },
      ...rest,
    },
  );
}

/** Marks a product final sale in the till's reference, as a pull of `finalSale: true` would. */
export const markFinalSale = (db: TillDatabase, productId: string) =>
  db.transaction((tx) =>
    tx.run(
      sql`UPDATE reference SET payload = json_set(payload, '$.finalSale', json('true')) WHERE entity = 'product' AND id = ${productId}`,
    ),
  );

export const refundRows = (db: TillDatabase) => db.read((tx) => tx.select().from(refundTable));
export const movementRows = (db: TillDatabase) => db.read((tx) => tx.select().from(stockMovement));

/** Saves register settings (the defaults plus `over`) as a signed-in clerk who may. */
export async function saveSettings(db: TillDatabase, over: Record<string, unknown>) {
  const names = { shopName: "Shop", registerName: "Till 1" };
  const { revision, value } = await readRegisterSettings(db, { ...scope, ...names });
  return saveRegisterSettings(
    db,
    { ...ctx, appVersion: config.appVersion },
    { ...scope, ...names },
    {
      settings: { ...value, ...over },
      expectedRevision: revision,
      session: clerk,
      at: new Date(refundNow),
    },
  );
}
