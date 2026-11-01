import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { org, shopLogin, type ShopperDatabase } from "@shopper/db-pg";
import type { Delivery } from "@shopper/ports";
import type { Sms } from "../sms/types";
import { LOGIN_MAX_ATTEMPTS, loginCode } from "./otp";
import { shopOtpMessage } from "./schemas/messages";

/**
 * Texts one sign-in code. Only the login's latest send of a login still waiting for its code is texted; a
 * superseded, used, locked or lapsed one is acknowledged silently. A redelivery texts the same code again.
 */
export async function deliverShopCode(
  deps: { db: ShopperDatabase; sms?: Sms; linkSecret?: string },
  delivery: Delivery,
) {
  if (!deps.sms || !deps.linkSecret) return await delivery.retry();
  try {
    const { loginId, send } = v.parse(shopOtpMessage, delivery.message).payload;
    const [row] = await deps.db
      .select({ login: shopLogin, shop: org.name })
      .from(shopLogin)
      .innerJoin(org, eq(org.id, shopLogin.orgId))
      .where(and(eq(shopLogin.orgId, delivery.message.orgId), eq(shopLogin.id, loginId)));
    const waiting =
      row &&
      row.login.sends === send &&
      !row.login.verifiedAt &&
      row.login.attempts < LOGIN_MAX_ATTEMPTS &&
      row.login.expiresAt > new Date();
    if (!waiting) return await delivery.ack();
    const code = await loginCode(deps.linkSecret, loginId, send);
    await deps.sms.send(
      [row.login.phone],
      `${code} is your ${row.shop} sign-in code. It expires in 10 minutes. Never share it.`,
    );
    await delivery.ack();
  } catch (error) {
    console.error({ event: "shop.otp.deliver_failed", attempts: delivery.attempts, error });
    await delivery.retry();
  }
}
