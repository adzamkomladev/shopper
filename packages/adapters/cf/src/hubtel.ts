import { createHubtel } from "@shopper/core/payments/hubtel";

/** Hubtel for orgs that collect MoMo through it; its outcome callback comes back through the portal's `/api`. */
export function cloudflareHubtel(env: {
  HUBTEL_CLIENT_ID?: string;
  HUBTEL_CLIENT_SECRET?: string;
  HUBTEL_MERCHANT_ACCOUNT?: string;
  SHOPPER_AUTH_URL?: string;
}) {
  if (
    !env.HUBTEL_CLIENT_ID ||
    !env.HUBTEL_CLIENT_SECRET ||
    !env.HUBTEL_MERCHANT_ACCOUNT ||
    !env.SHOPPER_AUTH_URL
  )
    return undefined;
  return createHubtel({
    clientId: env.HUBTEL_CLIENT_ID,
    clientSecret: env.HUBTEL_CLIENT_SECRET,
    merchantAccount: env.HUBTEL_MERCHANT_ACCOUNT,
    callbackUrl: `${env.SHOPPER_AUTH_URL}/api/webhooks/hubtel`,
  });
}
