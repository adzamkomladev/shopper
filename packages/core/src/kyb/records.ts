import { and, eq, isNotNull } from "drizzle-orm";
import { v7 } from "uuid";
import { enqueueAfterCommit } from "@shopper/audit";
import { kybCase, type ShopperDatabase, type ShopperTransaction } from "@shopper/db-pg";
import type { KybNotice } from "./types";

/** One verification workflow per shop: a resubmission wakes, or restarts, the same instance. */
export const kybId = (orgId: string) => `kyb-${orgId}`;

/**
 * The Paystack subaccount a shop's MoMo is paid out to. It is kept when an approval lapses: payouts keep flowing
 * while the owner renews, and the admin app flags the lapsed case.
 */
export async function payoutSubaccount(db: ShopperDatabase | ShopperTransaction, orgId: string) {
  const [row] = await db
    .select({ code: kybCase.subaccountCode })
    .from(kybCase)
    .where(and(eq(kybCase.orgId, orgId), isNotNull(kybCase.subaccountCode)));
  return row?.code ?? undefined;
}

/** Queues what changed for the owners and the workflow, sent once the command's transaction commits. */
export function enqueueKybNotice(tx: ShopperTransaction, orgId: string, notice: KybNotice) {
  enqueueAfterCommit(tx, {
    id: v7(),
    orgId,
    v: 1,
    sequence: "0",
    type: "kyb.notice",
    payload: { notice },
  });
}

/** The shop's case, created as an empty draft the first time it is touched, locked for the command deciding on it. */
export async function lockKyb(tx: ShopperTransaction, orgId: string) {
  await tx.insert(kybCase).values({ orgId }).onConflictDoNothing({ target: kybCase.orgId });
  const [row] = await tx.select().from(kybCase).where(eq(kybCase.orgId, orgId)).for("update");
  return row!;
}
