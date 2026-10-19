import { and, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit/sqlite";
import type { CommandContext } from "@shopper/audit";
import { tillApprover, type TillDatabase } from "@shopper/db-sqlite";
import type { TillSession } from "../schemas/till/session";
import { TillError } from "./error";
import { checkSession, validateScope } from "./session";

// ponytail: offline approval knobs; make them register settings if a shop needs different ones.
export const MAX_FAILURES = 5;
export const LOCK_MS = 15 * 60_000;
export const APPROVER_LIST_MS = 7 * 86_400_000;

type Approval = { approverId: string; pin: string; permission: string; at: Date };
type Verify = (hash: string, pin: string) => Promise<boolean>;
type Scope = { orgId: string; deviceId: string; branchId: string };

/**
 * Checks an approver's PIN against the copy this register keeps; returns the approver's id. Five wrong PINs lock
 * the approver for 15 minutes; a list older than 7 days approves nothing. `verify` is injected so core never
 * imports auth.
 */
export function approve(
  db: TillDatabase,
  context: CommandContext,
  input: Approval,
  verify: Verify,
) {
  // Guesses for one approver run one at a time, so parallel requests cannot all read the same attempt count.
  // ponytail: in-process queue; the till host is one process. Move the count into the write if that changes.
  const key = `${context.orgId}:${input.approverId}`;
  const run = (pending.get(key) ?? Promise.resolve()).then(
    () => check(db, context, input, verify),
    () => check(db, context, input, verify),
  );
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  pending.set(key, settled);
  void settled.then(() => pending.get(key) === settled && pending.delete(key));
  return run;
}

const pending = new Map<string, Promise<void>>();

async function check(db: TillDatabase, context: CommandContext, input: Approval, verify: Verify) {
  const row = await db.read(async (tx) => {
    const [found] = await tx
      .select()
      .from(tillApprover)
      .where(and(eq(tillApprover.orgId, context.orgId), eq(tillApprover.userId, input.approverId)));
    return found;
  });
  const at = input.at.valueOf();
  if (!row || !row.permissions.includes(input.permission))
    throw new TillError("APPROVAL_FORBIDDEN", "This person cannot approve that");
  if (at - Date.parse(row.refreshedAt) > APPROVER_LIST_MS)
    throw new TillError("APPROVAL_OFFLINE", "Connect to the internet to approve");
  if (row.lockedUntil && row.lockedUntil > at)
    throw new TillError("APPROVAL_LOCKED", "Too many attempts. Try again in 15 minutes.");
  if (!(await verify(row.pinHash, input.pin))) {
    const attempts = (row.lockedUntil ? 0 : row.attempts) + 1;
    await failApproval(db, context, {
      approverId: row.userId,
      attempts,
      lockedUntil: attempts >= MAX_FAILURES ? at + LOCK_MS : null,
    });
    throw new TillError(
      "APPROVAL_INVALID",
      `Wrong PIN. ${Math.max(MAX_FAILURES - attempts, 0)} tries left`,
    );
  }
  if (row.attempts || row.lockedUntil) await resetApproval(db, context, { approverId: row.userId });
  return row.userId;
}

/**
 * Who authorises an action: a verified approver when one is given, otherwise the signed-in user when they hold
 * the permission and approval is not mandatory. The cashier session must be in scope and live either way.
 */
export function authorize(
  session: TillSession,
  scope: Scope,
  permission: string,
  at: Date,
  approverId: string | undefined,
  mandatory: boolean,
) {
  validateScope(session, scope, at);
  if (approverId) return approverId;
  if (mandatory) throw new TillError("APPROVAL_REQUIRED", "A manager must approve this");
  checkSession(session, scope, permission, at);
  return undefined;
}

const failApproval = defineCommand({
  name: "approval.failed",
  async run(
    tx,
    context,
    input: { approverId: string; attempts: number; lockedUntil: number | null },
  ) {
    await tx
      .update(tillApprover)
      .set({ attempts: input.attempts, lockedUntil: input.lockedUntil })
      .where(and(eq(tillApprover.orgId, context.orgId), eq(tillApprover.userId, input.approverId)));
  },
  audit: (input) => ({
    approverId: input.approverId,
    attempts: input.attempts,
    locked: !!input.lockedUntil,
  }),
});

const resetApproval = defineCommand({
  name: "approval.reset",
  async run(tx, context, input: { approverId: string }) {
    await tx
      .update(tillApprover)
      .set({ attempts: 0, lockedUntil: null })
      .where(and(eq(tillApprover.orgId, context.orgId), eq(tillApprover.userId, input.approverId)));
  },
  audit: (input) => input,
});
