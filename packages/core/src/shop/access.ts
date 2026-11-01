import * as v from "valibot";
import { and, eq, gt, isNull } from "drizzle-orm";
import { v7 } from "uuid";
import { shopAccount, shopSession, type ShopperDatabase } from "@shopper/db-pg";
import { uuidV7Schema, type Queue } from "@shopper/ports";
import { assertLinkSecret, sha256 } from "@shopper/utils";
import { ShopError } from "./error";
import { loginCode, loginDigest, SESSION_TTL_MS } from "./otp";
import { shopCode, shopPhone } from "./schemas/signin";
import { endSession, resendLogin, startLogin, verifyLogin } from "./signin";
import { readLoginSends } from "./queries";

/**
 * Phone sign-in for shoppers: start a login (the code goes out through the queue), check the code, and resolve the
 * cookie token of a signed-in browser. The token is only ever returned once; the database keeps its SHA-256.
 */
export function createShopAccess(options: {
  database: ShopperDatabase;
  linkSecret: string;
  appVersion: string;
  queue?: Queue;
  now?: () => Date;
}) {
  assertLinkSecret(options.linkSecret);
  const now = options.now ?? (() => new Date());
  const context = (orgId: string) => ({
    orgId,
    appVersion: options.appVersion,
    queue: options.queue,
  });
  const digest = async (loginId: string, send: number) =>
    loginDigest(options.linkSecret, loginId, await loginCode(options.linkSecret, loginId, send));

  return {
    async start(orgId: string, rawPhone: unknown) {
      const phone = parse(shopPhone, rawPhone);
      const id = v7();
      await startLogin(options.database, context(orgId), {
        id,
        phone,
        digest: await digest(id, 1),
        now: now(),
      });
      return { loginId: id, phone };
    },
    async resend(orgId: string, rawLoginId: unknown) {
      const loginId = parse(uuidV7Schema, rawLoginId);
      const send = (await readLoginSends(options.database, orgId, loginId)) + 1;
      const result = await resendLogin(options.database, context(orgId), {
        id: loginId,
        send,
        digest: await digest(loginId, send),
        now: now(),
      });
      return { sent: result.sent };
    },
    async verify(orgId: string, rawLoginId: unknown, rawCode: unknown) {
      const loginId = parse(uuidV7Schema, rawLoginId);
      const code = parse(shopCode, rawCode);
      const token = randomToken();
      const at = now();
      const expiresAt = new Date(at.getTime() + SESSION_TTL_MS);
      const result = await verifyLogin(options.database, context(orgId), {
        id: loginId,
        digest: await loginDigest(options.linkSecret, loginId, code),
        tokenDigest: await sha256(token),
        now: at,
        sessionExpiresAt: expiresAt,
      });
      if (result.outcome === "wrong")
        return { outcome: result.outcome, attemptsLeft: result.attemptsLeft };
      if (result.outcome !== "ok") return { outcome: result.outcome };
      return { outcome: "ok" as const, token, accountId: result.accountId, expiresAt };
    },
    /** The live session a cookie token names, with its shop and account; anything else is null. */
    async session(token: string) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
      const [found] = await options.database
        .select({
          sessionId: shopSession.id,
          orgId: shopSession.orgId,
          accountId: shopSession.accountId,
          phone: shopAccount.phone,
        })
        .from(shopSession)
        .innerJoin(
          shopAccount,
          and(eq(shopAccount.orgId, shopSession.orgId), eq(shopAccount.id, shopSession.accountId)),
        )
        .where(
          and(
            eq(shopSession.tokenDigest, await sha256(token)),
            isNull(shopSession.revokedAt),
            gt(shopSession.expiresAt, now()),
          ),
        );
      return found ?? null;
    },
    async signOut(token: string) {
      const found = await this.session(token);
      if (found)
        await endSession(options.database, context(found.orgId), {
          id: found.sessionId,
          now: now(),
        });
    },
  };
}

function parse<T extends v.GenericSchema>(schema: T, value: unknown): v.InferOutput<T> {
  const parsed = v.safeParse(schema, value);
  if (!parsed.success) throw new ShopError(parsed.issues[0].message, 400);
  return parsed.output;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
