import { and, eq } from "drizzle-orm";
import type { CommandContext } from "@shopper/audit";
import { kycCase, type ShopperDatabase, type ShopperTransaction } from "@shopper/db-pg";
import { assertHasPermission } from "../roles/service";
import { DECISION_WINDOW_MS } from "./otp";
import { KycError } from "./error";
import type { KycCaseRow } from "./types";

type Db = ShopperDatabase | ShopperTransaction;

/** The `workflow_run.type` of every case. */
export const KYC_RUN = "kyc";
export const openStatuses: readonly KycCaseRow["status"][] = ["otp_sent", "id_needed", "review"];
export const decisionDue = (now: Date) => new Date(now.getTime() + DECISION_WINDOW_MS);

/** The case, or NOT_FOUND. `lock` holds the row for the rest of the transaction. */
export async function readCaseRow(db: Db, orgId: string, id: string, lock = false) {
  const where = and(eq(kycCase.orgId, orgId), eq(kycCase.id, id));
  const [row] = await (lock
    ? db.select().from(kycCase).where(where).for("update")
    : db.select().from(kycCase).where(where));
  if (!row) throw new KycError("NOT_FOUND", "KYC case not found");
  return row;
}

/** A credit case is handled by whoever manages customers; a member case by whoever may write roles. */
export const assertCasePermission = (
  tx: ShopperTransaction,
  context: CommandContext,
  row: Pick<KycCaseRow, "purpose">,
) => assertHasPermission(tx, context, row.purpose === "credit" ? "customer.manage" : "role.write");

/** What a case is waiting out: the code's expiry first, then the decision window. */
export const caseDeadline = (row: KycCaseRow) =>
  row.status === "otp_sent" ? row.otpExpiresAt : row.decisionDueAt;

export const isOpen = (row: KycCaseRow) => openStatuses.includes(row.status);

export async function closeAsExpired(tx: ShopperTransaction, row: KycCaseRow) {
  await tx
    .update(kycCase)
    .set({ status: "expired", otpDigest: null, updatedAt: new Date() })
    .where(and(eq(kycCase.orgId, row.orgId), eq(kycCase.id, row.id)));
}

/** Expires an open case whose deadline has passed, so a lost timer never lets a late answer through. */
export async function lapse(tx: ShopperTransaction, row: KycCaseRow, now: Date) {
  const deadline = caseDeadline(row);
  if (!isOpen(row) || !deadline || deadline > now) return false;
  await closeAsExpired(tx, row);
  return true;
}
