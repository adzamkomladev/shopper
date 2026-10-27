import { runWatchdog } from "@shopper/core/reports";
import { hyperdriveDatabase } from "./database";
import { cloudflareLauncher } from "./launcher";

/**
 * The Worker's `scheduled` handler: the one daily cron (23:59 UTC) starts each org's audit anchor and (with Paystack)
 * settlement fetch, each store's day for today and tomorrow, and each billing period falling due.
 */
export async function cloudflareWatchdog(
  controller: { scheduledTime: number },
  env: {
    HYPERDRIVE: Hyperdrive;
    AUDIT_ANCHOR: Parameters<typeof cloudflareLauncher>[0];
    STORE_DAY: Parameters<typeof cloudflareLauncher>[0];
    SETTLEMENT?: Parameters<typeof cloudflareLauncher>[0];
    BILLING?: Parameters<typeof cloudflareLauncher>[0];
    PAYSTACK_SECRET_KEY?: string;
  },
) {
  await runWatchdog(
    {
      withDatabase: hyperdriveDatabase(env.HYPERDRIVE),
      anchors: cloudflareLauncher(env.AUDIT_ANCHOR),
      storeDays: cloudflareLauncher(env.STORE_DAY),
      settlements:
        env.SETTLEMENT && env.PAYSTACK_SECRET_KEY ? cloudflareLauncher(env.SETTLEMENT) : undefined,
      billing: env.BILLING ? cloudflareLauncher(env.BILLING) : undefined,
    },
    new Date(controller.scheduledTime),
  );
}
