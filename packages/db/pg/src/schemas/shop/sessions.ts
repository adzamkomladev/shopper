import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenant } from "../base";
import { shopAccount } from "./accounts";

/**
 * One sign-in attempt by phone. The code is derived from the row's id and send number, so only a keyed digest of
 * the latest code is kept; a wrong guess is counted and the fifth locks the attempt.
 */
export const shopLogin = pgTable(
  "shop_login",
  {
    ...tenant(),
    phone: text("phone").notNull(),
    otpDigest: text("otp_digest"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    sends: integer("sends").notNull().default(1),
    attempts: integer("attempts").notNull().default(0),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    check("shop_login_phone_format", sql`${t.phone} ~ '^0[0-9]{9}$'`),
    check("shop_login_sends", sql`${t.sends} BETWEEN 1 AND 3`),
    check("shop_login_attempts", sql`${t.attempts} BETWEEN 0 AND 5`),
  ],
);

/** A signed-in browser. Only the SHA-256 of its cookie token is kept; the row alone cannot sign anyone in. */
export const shopSession = pgTable(
  "shop_session",
  {
    ...tenant(),
    accountId: uuid("account_id").notNull(),
    tokenDigest: text("token_digest").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique("shop_session_token").on(t.tokenDigest),
    foreignKey({
      columns: [t.orgId, t.accountId],
      foreignColumns: [shopAccount.orgId, shopAccount.id],
    }).onDelete("cascade"),
  ],
);
