import { buildInfo } from "@shopper/config";
import { createSdc } from "@shopper/core/fiscal";
import { boxFiscalArchive, boxLane } from "@shopper/adapters-box";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { Blobs } from "@shopper/ports";
import type { Launch } from "@shopper/adapters-box";

/** The box's fiscal lane, only when an SDC is configured; its stores get their lane and bundle back on boot. */
export async function bootFiscalLane(
  environment: Record<string, string | undefined>,
  options: { database: ShopperDatabase; blobs: () => Promise<Blobs>; launch: Launch },
) {
  if (!environment.SHOPPER_SDC_URL || !environment.SHOPPER_SDC_KEY) return undefined;
  const archive = boxFiscalArchive(
    { database: options.database, blobs: await options.blobs() },
    options.launch,
  );
  const lane = boxLane({
    db: options.database,
    sdc: createSdc({ url: environment.SHOPPER_SDC_URL, apiKey: environment.SHOPPER_SDC_KEY }),
    appVersion: buildInfo.version,
    archive: archive.launcher,
  });
  // On boot every store with documents still waiting for the SDC gets its lane back, and its bundle.
  Promise.all([lane.relaunch(), archive.relaunch()]).catch((error: unknown) =>
    console.error({ event: "fiscal.relaunch_failed", error }),
  );
  return lane;
}
