import { and, eq } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { accountHold, creditEntry, loyaltyEntry, type ShopperTransaction } from "@shopper/db-pg";
import type { Money } from "@shopper/money";
import { SaleError } from "../../sales/error";
import type { HoldInput } from "../../schemas/customers/credit";
import type { SaleSnapshot } from "../../schemas/till/sale";
import { CustomerError } from "../error";
import { accountSummary } from "./account";
import { authorize } from "./authority";
import type { Authority } from "../types";
import { pointsValue, takePoints } from "../loyalty/holds";

type Row = typeof accountHold.$inferSelect;

/** A points hold also says how many points and what they are worth; a credit hold, its amount. */
const holdView = (row: Row) => ({
  id: row.id,
  customerId: row.customerId,
  kind: row.kind,
  amount: row.amount,
  status: row.status,
  ...(row.kind === "loyalty" && {
    points: row.points!,
    value: pointsValue(row.points!, row.pointValue!),
  }),
});
const sameHold = (saved: Row, hold: HoldInput) =>
  saved.kind === hold.kind &&
  (hold.kind === "credit" ? saved.amount === hold.amount : saved.points === hold.points);

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
      !sameHold(saved, hold) ||
      saved.deviceId !== input.principal.deviceId
    )
      throw new CustomerError("CONFLICT", "Hold identity already has different content");
    return { output: { hold: holdView(saved), replayed: true } };
  },
  async run(tx, ctx, input) {
    await authorize(tx, ctx, input);
    const { hold } = input;
    const size =
      hold.kind === "loyalty"
        ? {
            points: hold.points,
            pointValue: await takePoints(tx, ctx.orgId, hold.customerId, hold.points),
          }
        : { amount: await takeCredit(tx, ctx.orgId, hold.customerId, hold.amount) };
    const [row] = await tx
      .insert(accountHold)
      .values({
        ...size,
        id: hold.id,
        orgId: ctx.orgId,
        customerId: hold.customerId,
        kind: hold.kind,
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

/** Checks the credit a customer has available and answers the amount to hold. */
async function takeCredit(
  tx: ShopperTransaction,
  orgId: string,
  customerId: string,
  amount: Money,
) {
  const account = await accountSummary(tx, orgId, customerId, true);
  if (!account.eligible)
    throw new CustomerError("NOT_ELIGIBLE", "The customer cannot buy on account");
  if (amount > account.available)
    throw new CustomerError("CREDIT_LIMIT", "The amount is over the credit available", {
      available: account.available,
    });
  return amount;
}

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
 * Spends the hold behind every account tender of an accepted sale: credit becomes a charge on the account, points a
 * `redeem` entry. A tender without an unconsumed hold of the same customer, size, register, branch and cashier was
 * forged: INVALID_PAYMENT. A hold past its hour still settles, since the sale was made while it counted. Runs after
 * the sale row is written.
 */
export async function consumeHolds(
  tx: ShopperTransaction,
  ctx: CommandContext,
  snapshot: SaleSnapshot,
  occurredAt: Date,
) {
  for (const tender of snapshot.tenders) {
    if (tender.kind !== "credit" && tender.kind !== "loyalty") continue;
    const hold = await findHold(tx, ctx.orgId, tender.id, true);
    const worth =
      hold?.kind === "loyalty" && hold.points && hold.pointValue
        ? pointsValue(hold.points, hold.pointValue)
        : hold?.amount;
    if (
      !hold ||
      hold.status !== "held" ||
      hold.kind !== tender.kind ||
      hold.customerId !== snapshot.customer?.id ||
      worth !== tender.amount ||
      (hold.kind === "loyalty" && hold.points !== tender.points) ||
      hold.deviceId !== snapshot.deviceId ||
      hold.branchId !== snapshot.branchId ||
      hold.cashierId !== snapshot.cashierId
    )
      throw new SaleError("INVALID_PAYMENT", "Account tender has no matching hold");
    await tx
      .update(accountHold)
      .set({ status: "consumed", saleId: snapshot.id, updatedAt: new Date() })
      .where(and(eq(accountHold.orgId, ctx.orgId), eq(accountHold.id, hold.id)));
    const entry = {
      orgId: ctx.orgId,
      customerId: hold.customerId,
      saleId: snapshot.id,
      holdId: hold.id,
      actorId: snapshot.cashierId,
      occurredAt,
    };
    if (hold.kind === "credit")
      await tx.insert(creditEntry).values({ ...entry, kind: "charge", amount: tender.amount });
    else
      await tx.insert(loyaltyEntry).values({ ...entry, reason: "redeem", points: -hold.points! });
  }
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
