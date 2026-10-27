import { buildInfo } from "@shopper/config";
import { createHubtel } from "@shopper/core/payments/hubtel";
import { createPaystack } from "@shopper/core/payments/paystack";
import type { Realtime } from "@shopper/ports";
import { boxApprovals, boxMomoPayment, boxMomoRefund, boxSettlements } from "@shopper/adapters-box";

type Database = Parameters<typeof boxSettlements>[0]["database"];

/**
 * The box's payment workflows: MoMo collection and refunds through Paystack or (per org) Hubtel, the daily
 * settlement fetch, and remote manager approvals. Without a Paystack key only approvals run.
 */
export function boxPayments(
  environment: Record<string, string | undefined>,
  options: { database: Database; realtime: Realtime; baseUrl: string },
) {
  const hubtel =
    environment.HUBTEL_CLIENT_ID &&
    environment.HUBTEL_CLIENT_SECRET &&
    environment.HUBTEL_MERCHANT_ACCOUNT
      ? createHubtel({
          clientId: environment.HUBTEL_CLIENT_ID,
          clientSecret: environment.HUBTEL_CLIENT_SECRET,
          merchantAccount: environment.HUBTEL_MERCHANT_ACCOUNT,
          callbackUrl: `${options.baseUrl}/webhooks/hubtel`,
        })
      : undefined;
  const approvals = boxApprovals({
    withDatabase: (run) => run(options.database),
    realtime: options.realtime,
    appVersion: buildInfo.version,
  });
  if (!environment.PAYSTACK_SECRET_KEY) return { hubtel, approvals };
  const paystack = createPaystack({
    secretKey: environment.PAYSTACK_SECRET_KEY,
    baseUrl: environment.PAYSTACK_BASE_URL,
  });
  const momo = {
    withDatabase: <T>(run: (db: Database) => Promise<T>) => run(options.database),
    appVersion: buildInfo.version,
    paystack,
    hubtel,
  };
  return {
    hubtel,
    approvals,
    momoPayment: boxMomoPayment({ ...momo, realtime: options.realtime }),
    momoRefund: boxMomoRefund(momo),
    settlements: boxSettlements({ database: options.database, paystack }),
  };
}
