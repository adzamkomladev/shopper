import { and, count, eq, gt } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, enqueueAfterCommit } from "@shopper/audit";
import { shopAccount, shopLogin, shopSession, type ShopperTransaction } from "@shopper/db-pg";
import { ShopError } from "./error";
import { LOGIN_MAX_ATTEMPTS, LOGIN_MAX_SENDS, LOGIN_TTL_MS, LOGINS_PER_HOUR } from "./otp";

const entity = (id: string) => ({ entity: "shop_login", entityId: id });

/** Opens a login for a phone and queues its first code. The message names the login and send, never the code. */
export const startLogin = defineCommand({
  name: "shop.login.start",
  async run(tx, context, input: { id: string; phone: string; digest: string; now: Date }) {
    // The command holds the org's lock, so two requests cannot both slip under the cap.
    const [recent] = await tx
      .select({ logins: count() })
      .from(shopLogin)
      .where(
        and(
          eq(shopLogin.orgId, context.orgId),
          eq(shopLogin.phone, input.phone),
          gt(shopLogin.createdAt, new Date(input.now.getTime() - 60 * 60_000)),
        ),
      );
    if (recent!.logins >= LOGINS_PER_HOUR)
      throw new ShopError("Too many codes for this number. Try again in an hour.", 429);
    await tx.insert(shopLogin).values({
      id: input.id,
      createdAt: input.now,
      orgId: context.orgId,
      phone: input.phone,
      otpDigest: input.digest,
      expiresAt: new Date(input.now.getTime() + LOGIN_TTL_MS),
    });
    queueCode(tx, context.orgId, input.id, 1);
    return { id: input.id, phone: input.phone };
  },
  audit: (_input, output) => ({ loginId: output.id, phone: output.phone }),
  details: (_input, output) => entity(output.id),
});

/** The next code for an open login; wrong guesses carry over. Past the third send, or once used or locked, nothing is sent. */
export const resendLogin = defineCommand({
  name: "shop.login.resend",
  async run(tx, context, input: { id: string; send: number; digest: string; now: Date }) {
    const row = await readLogin(tx, context.orgId, input.id);
    const open = !row.verifiedAt && row.attempts < LOGIN_MAX_ATTEMPTS;
    if (!open || row.sends >= LOGIN_MAX_SENDS || row.sends + 1 !== input.send)
      return { id: row.id, send: input.send, sent: false };
    await tx
      .update(shopLogin)
      .set({
        otpDigest: input.digest,
        expiresAt: new Date(input.now.getTime() + LOGIN_TTL_MS),
        sends: input.send,
        updatedAt: input.now,
      })
      .where(and(eq(shopLogin.orgId, context.orgId), eq(shopLogin.id, row.id)));
    queueCode(tx, context.orgId, row.id, input.send);
    return { id: row.id, send: input.send, sent: true };
  },
  audit: (_input, output) => ({ loginId: output.id, send: output.send, sent: output.sent }),
  details: (_input, output) => entity(output.id),
});

type Verified =
  | { outcome: "ok"; accountId: string; sessionId: string }
  | { outcome: "wrong"; attemptsLeft: number }
  | { outcome: "locked" }
  | { outcome: "expired" };

/**
 * Checks a typed code. A wrong guess is counted and the fifth locks the login, so a miss commits rather than
 * rolling back. The right code is spent at once, finds or makes the phone's account, and opens a session.
 */
export const verifyLogin = defineCommand({
  name: "shop.login.verify",
  async run(
    tx,
    context,
    input: { id: string; digest: string; tokenDigest: string; now: Date; sessionExpiresAt: Date },
  ): Promise<Verified & { loginId: string }> {
    const row = await readLogin(tx, context.orgId, input.id);
    const result = (verified: Verified) => ({ ...verified, loginId: row.id });
    if (row.verifiedAt || !row.otpDigest || row.expiresAt <= input.now)
      return result({ outcome: "expired" });
    if (row.attempts >= LOGIN_MAX_ATTEMPTS) return result({ outcome: "locked" });
    // A plain comparison leaks nothing: both sides are keyed digests the guesser cannot compute.
    if (row.otpDigest !== input.digest) {
      const attempts = row.attempts + 1;
      await tx
        .update(shopLogin)
        .set({ attempts, updatedAt: input.now })
        .where(and(eq(shopLogin.orgId, context.orgId), eq(shopLogin.id, row.id)));
      return result(
        attempts >= LOGIN_MAX_ATTEMPTS
          ? { outcome: "locked" }
          : { outcome: "wrong", attemptsLeft: LOGIN_MAX_ATTEMPTS - attempts },
      );
    }
    await tx
      .update(shopLogin)
      .set({ verifiedAt: input.now, otpDigest: null, updatedAt: input.now })
      .where(and(eq(shopLogin.orgId, context.orgId), eq(shopLogin.id, row.id)));
    await tx
      .insert(shopAccount)
      .values({ orgId: context.orgId, phone: row.phone })
      .onConflictDoNothing({ target: [shopAccount.orgId, shopAccount.phone] });
    const [account] = await tx
      .select({ id: shopAccount.id })
      .from(shopAccount)
      .where(and(eq(shopAccount.orgId, context.orgId), eq(shopAccount.phone, row.phone)));
    const sessionId = v7();
    await tx.insert(shopSession).values({
      id: sessionId,
      orgId: context.orgId,
      accountId: account!.id,
      tokenDigest: input.tokenDigest,
      expiresAt: input.sessionExpiresAt,
    });
    return result({ outcome: "ok", accountId: account!.id, sessionId });
  },
  audit: (_input, output) => ({
    loginId: output.loginId,
    outcome: output.outcome,
    ...(output.outcome === "ok"
      ? { accountId: output.accountId, sessionId: output.sessionId }
      : {}),
  }),
  details: (_input, output) => entity(output.loginId),
});

/** Ends one browser's session; a session already ended stays ended. */
export const endSession = defineCommand({
  name: "shop.session.end",
  async run(tx, context, input: { id: string; now: Date }) {
    await tx
      .update(shopSession)
      .set({ revokedAt: input.now, updatedAt: input.now })
      .where(and(eq(shopSession.orgId, context.orgId), eq(shopSession.id, input.id)));
    return { id: input.id };
  },
  audit: (_input, output) => ({ sessionId: output.id }),
  details: (_input, output) => ({ entity: "shop_session", entityId: output.id }),
});

async function readLogin(tx: ShopperTransaction, orgId: string, id: string) {
  const [row] = await tx
    .select()
    .from(shopLogin)
    .where(and(eq(shopLogin.orgId, orgId), eq(shopLogin.id, id)))
    .for("update");
  if (!row) throw new ShopError("This sign-in has ended. Ask for a new code.", 404);
  return row;
}

function queueCode(tx: ShopperTransaction, orgId: string, loginId: string, send: number) {
  enqueueAfterCommit(tx, {
    id: v7(),
    orgId,
    v: 1,
    sequence: "0",
    type: "shop.otp",
    payload: { loginId, send },
  });
}
