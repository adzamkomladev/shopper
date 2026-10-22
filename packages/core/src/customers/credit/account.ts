import { and, eq, gt, sql } from "drizzle-orm";
import { accountHold, cashierSession, customer, org, type ShopperDatabase } from "@shopper/db-pg";
import { fromBigInt, money, sub } from "@shopper/money";
import { sha256 } from "@shopper/utils";
import { SaleError } from "../../sales/error";
import type { UploadPrincipal } from "../../sales/types";
import type { Queryable } from "../../types";
import { readCustomerRow } from "../queries";

/** How long a held row counts against the customer; an older unconsumed hold still settles its sale. */
export const HOLD_TTL = sql`interval '1 hour'`;

/**
 * What a customer may spend on account now: limit − balance − held, never below zero. Eligible means KYC-verified
 * with a limit, or holding a deposit (a negative balance). `lock` takes the customer row lock before the folds.
 */
export async function accountSummary(db: Queryable, orgId: string, id: string, lock = false) {
  const row = await readCustomerRow(db, orgId, id, lock);
  const [{ held }] = (await db
    .select({ held: sql<string>`COALESCE(SUM(${accountHold.amount}), 0)::text` })
    .from(accountHold)
    .where(
      and(
        eq(accountHold.orgId, orgId),
        eq(accountHold.customerId, row.id),
        eq(accountHold.kind, "credit"),
        eq(accountHold.status, "held"),
        gt(accountHold.createdAt, sql`now() - ${HOLD_TTL}`),
      ),
    )) as [{ held: string }];
  const [extra] = await db
    .select({
      verifiedAt: customer.kycVerifiedAt,
      loyaltyEnabled: org.loyaltyEnabled,
      pointValue: org.loyaltyPointValue,
    })
    .from(customer)
    .innerJoin(org, eq(org.id, customer.orgId))
    .where(and(eq(customer.orgId, orgId), eq(customer.id, row.id)));
  const heldMoney = fromBigInt(BigInt(held));
  const limit = row.creditLimit;
  const open = !row.archivedAt && !row.mergedIntoId;
  return {
    limit,
    balance: row.balance,
    held: heldMoney,
    available: money(Math.max(0, sub(sub(limit, row.balance), heldMoney))),
    eligible: open && ((Boolean(extra?.verifiedAt) && limit > 0) || row.balance < 0),
    points: row.points,
    pointValue: extra!.pointValue,
    loyaltyEnabled: extra!.loyaltyEnabled,
  };
}

/** The cashier behind a till request on the account lane, before the command checks the session in full. */
export async function tillActor(
  db: ShopperDatabase,
  principal: UploadPrincipal,
  body: { orgId: string; sessionId: string },
  proof: string,
  appVersion: string,
) {
  if (body.orgId !== principal.orgId)
    throw new SaleError("SCOPE", "Request is outside the enrolled device scope");
  const proofHash = await sha256(proof);
  const [session] = await db
    .select({ userId: cashierSession.userId })
    .from(cashierSession)
    .where(
      and(
        eq(cashierSession.orgId, principal.orgId),
        eq(cashierSession.id, body.sessionId),
        eq(cashierSession.tokenHash, proofHash),
      ),
    );
  if (!session) throw new SaleError("INVALID_SESSION", "Request lacks a valid cashier session");
  return {
    proofHash,
    cashierId: session.userId,
    context: {
      orgId: principal.orgId,
      deviceId: principal.deviceId,
      branchId: principal.branchId,
      actorId: session.userId,
      appVersion,
    },
  };
}
