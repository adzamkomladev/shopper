import { runWatchdog } from "@shopper/core/audit";
import { cloudflareDatabase } from "./database";
import { cloudflareLauncher } from "./launcher";

/** The Worker's `scheduled` handler: the one daily cron (23:59 UTC) starts each org's audit anchor. */
export async function cloudflareWatchdog(
  controller: { scheduledTime: number },
  env: { HYPERDRIVE: Hyperdrive; AUDIT_ANCHOR: Parameters<typeof cloudflareLauncher>[0] },
) {
  await runWatchdog(
    {
      withDatabase: async (run) => {
        const connection = await cloudflareDatabase(env.HYPERDRIVE.connectionString);
        try {
          return await run(connection.db);
        } finally {
          await connection.close();
        }
      },
      anchors: cloudflareLauncher(env.AUDIT_ANCHOR),
    },
    new Date(controller.scheduledTime),
  );
}
