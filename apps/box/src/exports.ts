import { boxArchiveExport, boxCloudMove, type Launch } from "@shopper/adapters-box";
import type { BoxLicence } from "@shopper/api";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { Blobs } from "@shopper/ports";

/** The box's archive workflow, with any archive the in-process engine forgot on restart started again from its row. */
export function bootArchiveExport(...args: Parameters<typeof boxArchiveExport>) {
  const archive = boxArchiveExport(...args);
  archive
    .relaunch()
    .catch((error: unknown) => console.error({ event: "export.relaunch_failed", error }));
  return archive;
}

/** The box's move to the cloud, with a move a restart cut off carried on from where it stopped. */
export function bootCloudMove(
  licence: BoxLicence,
  database: ShopperDatabase,
  blobs: Blobs,
  launch: Launch,
) {
  const move = boxCloudMove(
    { database, blobs, cloud: (url, init) => licence.send(url, init) },
    launch,
  );
  move
    .relaunch()
    .catch((error: unknown) => console.error({ event: "move.relaunch_failed", error }));
  return move;
}
