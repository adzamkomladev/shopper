import { and, eq } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { accountHold, creditEntry, type ShopperTransaction } from "@shopper/db-pg";
import { sessionAuthority } from "../../sales/authority";
import { SaleError } from "../../sales/error";
import type { UploadPrincipal } from "../../sales/types";
import type { HoldInput } from "../../schemas/customers/credit";
import type { SaleSnapshot } from "../../schemas/till/sale";
import { CustomerError } from "../error";
import { accountSummary } from "./account";

type Authority = {
  principal: UploadPrincipal;
  sessionId: string;
  cashierId: string;
  proofHash: string;
};
type Row = typeof accountHold.$inferSelect;

const holdView = (row: Row) => ({
  id: row.id,
  customerId: row.customerId,
  kind: row.kind,
  amount: row.amount,
  status: row.status,
});

/**
 * Sets credit aside for a till tender, under the customer's row lock so two registers cannot both spend the
 * last of it. The same id and content replays; other content under the id is CONFLICT.
 */
export const createHold = defineCommand({
  name: "customer.hold.create",
  async replay(tx, ctx, input: Authority & { hold: HoldInput }) {
    const saved = await findHold(tx, ctx.orgId, input.hold.id);
    if (!saved) return undefined;
    await authorize(tx, ctx, input);
    const { hold } = input;
    if (
      saved.customerId !== hold.customerId ||
      saved.kind !== hold.kind ||
      saved.amount !== hold.amount ||
      saved.deviceId !== input.principal.deviceId
    )
      throw new CustomerError("CONFLICT", "Hold identity already has different content");
    return { output: { hold: holdView(saved), replayed: true } };
  },
  async run(tx, ctx, input) {
    await authorize(tx, ctx, input);
    const { hold } = input;
    const account = await accountSummary(tx, ctx.orgId, hold.customerId, true);
    if (!account.eligible)
      throw new CustomerError("NOT_ELIGIBLE", "The customer cannot buy on account");
    if (hold.amount > account.available)
      throw new CustomerError("CREDIT_LIMIT", "The amount is over the credit available", {
        available: account.available,
      });
    const [row] = await tx
      .insert(accountHold)
      .values({
        id: hold.id,
        orgId: ctx.orgId,
        customerId: hold.customerId,
        kind: hold.kind,
        amount: hold.amount,
        branchId: input.principal.branchId,
        deviceId: input.principal.deviceId,
        cashierId: input.cashierId,
      })
      .returning();
    return { hold: holdView(row!), replayed: false };
  },
  audit: (_input, output) => ({ ...output.hold }),
  details: (_input, output) => ({ entity: "customer", entityId: output.hold.customerId }),
});

/** Frees a hold this register took. Releasing twice is a no-op; a consumed hold is CONFLICT. */
export const releaseHold = defineCommand({
  name: "customer.hold.release",
  async replay(tx, ctx, input: Authority & { id: string }) {
    const saved = await ownHold(tx, ctx, input);
    if (saved.status !== "released") return undefined;
    await authorize(tx, ctx, input);
    return { output: { hold: holdView(saved) } };
  },
  async run(tx, ctx, input) {
    await authorize(tx, ctx, input);
    const saved = await ownHold(tx, ctx, input, true);
    if (saved.status === "consumed")
      throw new CustomerError("CONFLICT", "The hold already settled a sale");
    const [row] = await tx
      .update(accountHold)
      .set({ status: "released", updatedAt: new Date() })
      .where(and(eq(accountHold.orgId, ctx.orgId), eq(accountHold.id, saved.id)))
      .returning();
    return { hold: holdView(row!) };
  },
  audit: (_input, output) => ({ ...output.hold }),
  details: (_input, output) => ({ entity: "customer", entityId: output.hold.customerId }),
});

/**
 * Spends the hold behind every account tender of an accepted sale and charges the account. A tender without an
 * unconsumed hold of the same customer, amount, register, branch and cashier was forged: INVALID_PAYMENT. A hold
 * past its hour still settles, since the sale was made while it counted. Runs after the sale row is written.
 */
export async function consumeHolds(
  tx: ShopperTransaction,
  ctx: CommandContext,
  snapshot: SaleSnapshot,
  occurredAt: Date,
) {
  for (const tender of snapshot.tenders) {
    if (tender.kind !== "credit") continue;
    const hold = await findHold(tx, ctx.orgId, tender.id, true);
    if (
      !hold ||
      hold.status !== "held" ||
      hold.kind !== "credit" ||
      hold.customerId !== snapshot.customer?.id ||
      hold.amount !== tender.amount ||
      hold.deviceId !== snapshot.deviceId ||
      hold.branchId !== snapshot.branchId ||
      hold.cashierId !== snapshot.cashierId
    )
      throw new SaleError("INVALID_PAYMENT", "Account tender has no matching hold");
    await tx
      .update(accountHold)
      .set({ status: "consumed", saleId: snapshot.id, updatedAt: new Date() })
      .where(and(eq(accountHold.orgId, ctx.orgId), eq(accountHold.id, hold.id)));
    await tx.insert(creditEntry).values({
      orgId: ctx.orgId,
      customerId: hold.customerId,
      kind: "charge",
      amount: tender.amount,
      saleId: snapshot.id,
      holdId: hold.id,
      actorId: snapshot.cashierId,
      occurredAt,
    });
  }
}

/** The register, a live session of the cashier, and `sale.create`, as of now. */
async function authorize(tx: ShopperTransaction, ctx: CommandContext, input: Authority) {
  const granted = await sessionAuthority(
    tx,
    ctx,
    input.principal,
    { sessionId: input.sessionId, cashierId: input.cashierId },
    input.proofHash,
    new Date(),
    "sale.create",
    "PERMISSION_DENIED",
  );
  ctx.role = granted.roleName;
}

async function findHold(tx: ShopperTransaction, orgId: string, id: string, lock = false) {
  const query = tx
    .select()
    .from(accountHold)
    .where(and(eq(accountHold.orgId, orgId), eq(accountHold.id, id)));
  const [row] = lock ? await query.for("update") : await query;
  return row;
}

/** A hold of this register, or NOT_FOUND. */
async function ownHold(
  tx: ShopperTransaction,
  ctx: CommandContext,
  input: Authority & { id: string },
  lock = false,
) {
  const saved = await findHold(tx, ctx.orgId, input.id, lock);
  if (!saved || saved.deviceId !== input.principal.deviceId)
    throw new CustomerError("NOT_FOUND", "Hold not found");
  return saved;
}
