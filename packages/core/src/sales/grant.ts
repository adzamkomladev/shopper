import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { hmacHex, hmacVerify, sha256 } from "@shopper/utils";
import { defineCommand } from "@shopper/audit";
import {
  cashierSession,
  member,
  sessionKey,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { fromBase64Url, toBase64Url } from "../licence/keys";
import { sessionGrantClaims, type SessionGrantClaims } from "../schemas/till/session";
import { hasGrant } from "./authority";
import { cutoffs } from "./offline";
import { SaleError } from "./error";
import type { UploadPrincipal } from "./types";

/** Signs a new server session with the org's session key, creating the key on the org's first sign-in. */
export async function signSessionGrant(tx: ShopperTransaction, claims: SessionGrantClaims) {
  const key = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  await tx.insert(sessionKey).values({ orgId: claims.orgId, key }).onConflictDoNothing();
  const [row] = await tx.select().from(sessionKey).where(eq(sessionKey.orgId, claims.orgId));
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
  return `${body}.${await hmacHex(row!.key, body)}`;
}

/**
 * Records again, once and audited, a server session this database lost: a box restored from a dump older than
 * the sign-in. Only a grant this org's key signed for this register, branch and proof is taken, and only while
 * the cashier still holds that role; it keeps the permissions the role still grants and ends where deactivation or
 * a branch scope cut the member off. Accepted limit: a revocation made after the dump was lost with the dump.
 */
export async function restoreServerSession(
  db: ShopperDatabase,
  principal: UploadPrincipal,
  input: { proof: string; grant: string },
  appVersion: string,
) {
  const claims = await readGrant(db, principal.orgId, input.grant);
  if (
    claims.orgId !== principal.orgId ||
    claims.deviceId !== principal.deviceId ||
    claims.branchId !== principal.branchId ||
    claims.tokenHash !== (await sha256(input.proof))
  )
    throw refused();
  return restore(
    db,
    {
      orgId: principal.orgId,
      deviceId: principal.deviceId,
      branchId: principal.branchId,
      appVersion,
    },
    claims,
  );
}

const restore = defineCommand({
  name: "cashier.session.restore",
  async replay(tx, ctx, claims: SessionGrantClaims) {
    const [known] = await tx
      .select({ id: cashierSession.id })
      .from(cashierSession)
      .where(and(eq(cashierSession.orgId, ctx.orgId), eq(cashierSession.id, claims.id)));
    return known ? { output: known } : undefined;
  },
  async run(tx, ctx, claims: SessionGrantClaims) {
    const [cashier] = await tx
      .select({ roleId: member.roleId })
      .from(member)
      .where(and(eq(member.orgId, ctx.orgId), eq(member.userId, claims.userId)));
    if (cashier?.roleId !== claims.roleId) throw refused();
    const issuedAt = new Date(claims.issuedAt);
    const permissions: string[] = [];
    for (const code of claims.permissions)
      if (await hasGrant(tx, ctx.orgId, claims.userId, code, issuedAt, claims.branchId))
        permissions.push(code);
    if (!permissions.length) throw refused();
    ctx.actorId = claims.userId;
    const [restored] = await tx
      .insert(cashierSession)
      .values({
        id: claims.id,
        orgId: ctx.orgId,
        deviceId: claims.deviceId,
        branchId: claims.branchId,
        userId: claims.userId,
        roleId: claims.roleId,
        roleName: claims.roleName,
        tokenHash: claims.tokenHash,
        issuedAt,
        expiresAt: new Date(
          Math.min(Date.parse(claims.expiresAt), ...(await cutoffs(tx, ctx.orgId, claims))),
        ),
        permissions,
      })
      .returning({ id: cashierSession.id });
    return { id: restored!.id };
  },
  audit: (claims) => ({
    userId: claims.userId,
    issuedAt: claims.issuedAt,
    expiresAt: claims.expiresAt,
    permissions: claims.permissions,
  }),
  details: (_claims, output) => ({ entity: "session", entityId: output.id }),
});

/** The claims of a grant this org's key signed, or a refusal; a grant from another key is not told apart. */
async function readGrant(db: ShopperDatabase, orgId: string, grant: string) {
  const cut = grant.lastIndexOf(".");
  const body = grant.slice(0, cut);
  const [row] = await db.select().from(sessionKey).where(eq(sessionKey.orgId, orgId));
  if (cut < 1 || !row || !(await hmacVerify(row.key, body, grant.slice(cut + 1)))) throw refused();
  const claims = v.safeParse(
    sessionGrantClaims,
    JSON.parse(new TextDecoder().decode(fromBase64Url(body))),
  );
  if (!claims.success) throw refused();
  return claims.output;
}

const refused = () =>
  new SaleError("INVALID_SESSION", "Session grant was not signed for this register");
