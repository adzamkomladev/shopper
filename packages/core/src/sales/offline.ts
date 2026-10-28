import * as v from "valibot";
import { sha256 } from "@shopper/utils";
import { and, eq, isNull } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import {
  cashierSession,
  member,
  memberBranch,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { tillId } from "../schemas/till/fields";
import { offlineWithheld, type OfflineSession } from "../schemas/till/session";
import { hasGrant } from "./authority";
import { SaleError } from "./error";
import type { UploadPrincipal } from "./types";

// The register's offline verifier lasts 7 days and an offline session 8 hours; nothing longer is adopted.
const VERIFIER_WINDOW_MS = 7 * 86_400_000;
const OFFLINE_SESSION_MS = 8 * 3_600_000;

/**
 * Records, once and audited, an offline session a register started after its server session expired, so
 * the sales and shifts it signed pass `sessionAuthority` like any other. It must follow from that server
 * session: the parent's proof plus `.<id>` is its own, the parent is live on the same register and branch,
 * it began within the verifier window and lasts at most eight hours, and it holds only permissions the
 * parent held and the role still grants, never a manager one. Accepted risk: the window is dated by the
 * register's corrected clock; a forged register could already forge sales, and revoking it stops both.
 */
export async function adoptOfflineSession(
  db: ShopperDatabase,
  principal: UploadPrincipal,
  input: { proof: string; offline: OfflineSession },
  appVersion: string,
) {
  // An offline proof is its parent's proof, a dot and its own id.
  const cut = input.proof.lastIndexOf(".");
  const sessionId = input.proof.slice(cut + 1);
  if (cut < 1 || !v.is(tillId, sessionId)) throw refused();
  return adopt(
    db,
    {
      orgId: principal.orgId,
      deviceId: principal.deviceId,
      branchId: principal.branchId,
      appVersion,
    },
    {
      principal,
      sessionId,
      offline: input.offline,
      proofHash: await sha256(input.proof),
      parentHash: await sha256(input.proof.slice(0, cut)),
    },
  );
}

type Input = {
  principal: UploadPrincipal;
  sessionId: string;
  offline: OfflineSession;
  proofHash: string;
  parentHash: string;
};

const adopt = defineCommand({
  name: "cashier.session.offline",
  async replay(tx, ctx, input: Input) {
    const [adopted] = await tx
      .select({ id: cashierSession.id, tokenHash: cashierSession.tokenHash })
      .from(cashierSession)
      .where(and(eq(cashierSession.orgId, ctx.orgId), eq(cashierSession.id, input.sessionId)));
    if (!adopted) return undefined;
    if (adopted.tokenHash !== input.proofHash) throw refused();
    return { output: { id: adopted.id } };
  },
  async run(tx, ctx, input: Input) {
    const [parent] = await tx
      .select()
      .from(cashierSession)
      .where(
        and(
          eq(cashierSession.orgId, ctx.orgId),
          eq(cashierSession.id, input.offline.parentSessionId),
          eq(cashierSession.deviceId, input.principal.deviceId),
          eq(cashierSession.branchId, input.principal.branchId),
          eq(cashierSession.tokenHash, input.parentHash),
          isNull(cashierSession.revokedAt),
          isNull(cashierSession.parentSessionId),
        ),
      );
    if (!parent) throw refused();
    const issuedAt = new Date(input.offline.issuedAt);
    const offlineEnd = new Date(input.offline.expiresAt);
    const length = offlineEnd.valueOf() - issuedAt.valueOf();
    // Deactivation and a branch scope that left this branch cut every session the member held; one adopted
    // later ends there too, so only what it sold before stands.
    const expiresAt = new Date(
      Math.min(offlineEnd.valueOf(), ...(await cutoffs(tx, ctx.orgId, parent))),
    );
    if (
      expiresAt <= issuedAt ||
      issuedAt < parent.issuedAt ||
      issuedAt.valueOf() > parent.expiresAt.valueOf() + VERIFIER_WINDOW_MS ||
      length <= 0 ||
      length > OFFLINE_SESSION_MS
    )
      throw refused();
    for (const code of input.offline.permissions) {
      if (!parent.permissions.includes(code) || offlineWithheld.includes(code)) throw refused();
      if (!(await hasGrant(tx, ctx.orgId, parent.userId, code, issuedAt, parent.branchId)))
        throw refused();
    }
    const [adopted] = await tx
      .insert(cashierSession)
      .values({
        id: input.sessionId,
        orgId: ctx.orgId,
        deviceId: parent.deviceId,
        branchId: parent.branchId,
        userId: parent.userId,
        roleId: parent.roleId,
        roleName: parent.roleName,
        tokenHash: input.proofHash,
        issuedAt,
        expiresAt,
        permissions: input.offline.permissions,
        parentSessionId: parent.id,
      })
      .returning({ id: cashierSession.id });
    return { id: adopted!.id };
  },
  audit: (input) => ({ ...input.offline }),
  details: (_input, output) => ({ entity: "session", entityId: output.id }),
});

/** When the member lost this session: deactivated, or limited to branches without this one (the scope's time). */
async function cutoffs(
  tx: ShopperTransaction,
  orgId: string,
  parent: { userId: string; branchId: string },
) {
  const rows = await tx
    .select({
      deactivatedAt: member.deactivatedAt,
      branchId: memberBranch.branchId,
      scopedAt: memberBranch.createdAt,
    })
    .from(member)
    .leftJoin(
      memberBranch,
      and(eq(memberBranch.orgId, member.orgId), eq(memberBranch.memberId, member.id)),
    )
    .where(and(eq(member.orgId, orgId), eq(member.userId, parent.userId)));
  const scoped = rows.filter((row) => row.branchId !== null);
  const outOfScope = scoped.length && !scoped.some((row) => row.branchId === parent.branchId);
  return [
    ...(rows[0]?.deactivatedAt ? [rows[0].deactivatedAt.valueOf()] : []),
    ...(outOfScope ? [Math.max(...scoped.map((row) => row.scopedAt!.valueOf()))] : []),
  ];
}

const refused = () =>
  new SaleError("INVALID_SESSION", "Offline session does not follow from a live server session");
