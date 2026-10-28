import { boxKybFlows, boxQueue } from "@shopper/adapters-box";
import { buildInfo } from "@shopper/config";
import type { ShopperDatabase } from "@shopper/db-pg";
import { deliverNotification } from "@shopper/core/notifications";
import { createPaystack } from "@shopper/core/payments/paystack";
import { NOTIFICATION_RETRY, type Blobs } from "@shopper/ports";
import type { createMaileroo } from "@shopper/auth";
import { startPaystackFake } from "../../../tooling/paystack/server";

/**
 * Business verification on an e2e host: a Paystack fake for the bank list and subaccounts, and a queue that hands
 * each `kyb.notice` to the KYB workflow on the box engine. The portal host starts the checks when an owner submits;
 * the admin host, its own process, picks the case up again from its rows when a reviewer decides. Other notices are
 * dropped, as they are on a host with no queue.
 */
export async function e2eKyb(deps: {
  database: ShopperDatabase;
  blobs: Blobs;
  mail: ReturnType<typeof createMaileroo>;
  baseUrl: string;
}) {
  const paystack = await startPaystackFake();
  const client = createPaystack({ secretKey: paystack.secretKey, baseUrl: paystack.baseUrl });
  const notifications = boxQueue(NOTIFICATION_RETRY, async (delivery) => {
    if (delivery.message.type !== "kyb.notice") return await delivery.ack();
    await deliverNotification(
      {
        db: deps.database,
        appVersion: buildInfo.version,
        baseUrl: deps.baseUrl,
        mail: deps.mail,
        kyb: flows,
      },
      delivery,
    );
  });
  const flows = boxKybFlows({
    withDatabase: (run) => run(deps.database),
    appVersion: buildInfo.version,
    queue: notifications,
    blobs: deps.blobs,
    paystack: client,
  });
  return { notifications, kyb: { banks: () => client.banks() } };
}
