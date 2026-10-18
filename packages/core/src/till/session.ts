import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { tillState, type TillDatabase } from "@shopper/db-sqlite";
import { tillSession, type TillSession } from "../schemas/till/session";
import { TillError } from "./error";

type Scope = { orgId: string; deviceId: string; branchId: string };

/** The session check shared by every till command; returns the draft scope of the cashier. */
export async function validateSession(
  db: TillDatabase,
  rawSession: unknown,
  input: { scope: Scope; permission: string; at: Date },
) {
  const session = v.parse(tillSession, rawSession);
  checkSession(session, input.scope, input.permission, await hostTime(db, input.scope, input.at));
  return {
    orgId: session.orgId,
    deviceId: session.deviceId,
    branchId: session.branchId,
    cashierId: session.userId,
  };
}

/** Device time corrected by the host clock offset kept in till_state. */
export async function hostTime(db: TillDatabase, scope: Scope, deviceTime: Date) {
  const clockOffsetMs = await db.read(async (tx) => {
    const [state] = await tx
      .select()
      .from(tillState)
      .where(and(eq(tillState.orgId, scope.orgId), eq(tillState.deviceId, scope.deviceId)));
    return state?.clockOffsetMs ?? 0;
  });
  return new Date(deviceTime.valueOf() - clockOffsetMs);
}

export function checkSession(session: TillSession, scope: Scope, permission: string, time: Date) {
  validateScope(session, scope, time);
  if (!session.permissions.includes(permission))
    throw new TillError("permission", `Session lacks ${permission} permission`);
}

/** The session belongs to this tenant, device and branch and is live at `time`; says nothing about permissions. */
export function validateScope(session: TillSession, scope: Scope, time: Date) {
  if (
    session.orgId !== scope.orgId ||
    session.deviceId !== scope.deviceId ||
    session.branchId !== scope.branchId
  )
    throw new TillError(
      "scope",
      "Cashier session is outside the configured tenant/device/branch scope",
    );
  if (
    !Number.isFinite(time.valueOf()) ||
    time < new Date(session.issuedAt) ||
    time >= new Date(session.expiresAt)
  )
    throw new TillError("session", "Cashier session is expired or not yet valid");
}
