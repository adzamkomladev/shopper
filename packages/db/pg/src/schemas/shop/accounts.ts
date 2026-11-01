import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tenant } from "../base";

/**
 * A shopper's online account at one shop, keyed by the phone they proved with a code. Name and email are theirs to
 * edit; the till's customer record with the same phone stays as staff keep it.
 */
export const shopAccount = pgTable(
  "shop_account",
  {
    ...tenant(),
    /** 0XXXXXXXXX, the same shape as customer.phone, so purchases are found by it. */
    phone: text("phone").notNull(),
    name: text("name"),
    email: text("email"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique("shop_account_phone").on(t.orgId, t.phone),
    check("shop_account_phone_format", sql`${t.phone} ~ '^0[0-9]{9}$'`),
  ],
);

/** Where a shopper wants deliveries; one per account may be the default. */
export const shopAddress = pgTable(
  "shop_address",
  {
    ...tenant(),
    accountId: uuid("account_id").notNull(),
    label: text("label").notNull(),
    line1: text("line1").notNull(),
    area: text("area").notNull(),
    city: text("city").notNull(),
    landmark: text("landmark"),
    phone: text("phone").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    foreignKey({
      columns: [t.orgId, t.accountId],
      foreignColumns: [shopAccount.orgId, shopAccount.id],
    }).onDelete("cascade"),
    uniqueIndex("shop_address_default")
      .on(t.orgId, t.accountId)
      .where(sql`${t.isDefault}`),
    check("shop_address_phone_format", sql`${t.phone} ~ '^0[0-9]{9}$'`),
  ],
);
