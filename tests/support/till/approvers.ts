// A till SQLite file holding one manager who can approve refunds and voids, with PIN 2468.
import { hashPin, verifyPin } from "@shopper/auth/devices";
import { approve, refreshApprovers } from "@shopper/core/till";
import type { TillDatabase } from "@shopper/db-sqlite";
import { at, context, ids } from "./drafts";

export { at, context, withTill } from "./drafts";
export { expectChain, auditRows } from "./drafts";
export const manager = "019a0000-0000-7000-8000-0000000000a1";
export const pin = "2468";

/**
 * Audit rows as JSON without their ids and hashes, which are random and can hold the PIN's digits by chance; a test
 * that the PIN never reaches the audit log checks what is left.
 */
export const auditText = (rows: unknown) =>
  JSON.stringify(rows).replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{64}/g,
    "",
  );

export async function syncManager(
  db: TillDatabase,
  permissions = ["refund.approve", "sale.void"],
  when = at,
) {
  await refreshApprovers(db, context, {
    approvers: [{ userId: manager, name: "Esi Manager", pinHash: await hashPin(pin), permissions }],
    at: when,
  });
}

export const tryApprove = (
  db: TillDatabase,
  guess = pin,
  permission = "refund.approve",
  when = at,
) => approve(db, context, { approverId: manager, pin: guess, permission, at: when }, verifyPin);
