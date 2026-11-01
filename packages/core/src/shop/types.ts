import type { createShopAccess } from "./access";

export type ShopAccess = ReturnType<typeof createShopAccess>;
/** A signed-in shopper: the shop, the account and the session their cookie names. */
export type ShopSession = NonNullable<Awaited<ReturnType<ShopAccess["session"]>>>;
