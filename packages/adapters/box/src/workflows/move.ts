import { ne } from "drizzle-orm";
import { buildInfo } from "@shopper/config";
import { cloudMoveId, cloudMoveParams, runCloudMove, type CloudMoveDeps } from "@shopper/export";
import { cloudMove, type ShopperDatabase } from "@shopper/db-pg";
import type { Blobs } from "@shopper/ports";
import type { Launch } from "../types";
import { memoryLaunch } from "./launch";

/**
 * The box moving its shop into the cloud (box only: the cloud never moves anywhere). `cloud` sends a licence-signed
 * request; `relaunch` at boot carries on a move a restart cut off (each step resumes from what is done).
 */
export function boxCloudMove(
  options: { database: ShopperDatabase; blobs: Blobs; cloud: CloudMoveDeps["cloud"] },
  launch: Launch = memoryLaunch,
) {
  const deps = {
    withDatabase: <T>(run: (db: ShopperDatabase) => Promise<T>) => run(options.database),
    blobs: options.blobs,
    appVersion: buildInfo.version,
    cloud: options.cloud,
  };
  const launcher = launch("cloud-move", cloudMoveParams, (flow, input) =>
    runCloudMove(flow, deps, input),
  );
  return {
    launcher,
    async relaunch() {
      const moves = await options.database
        .select({ orgId: cloudMove.orgId, moveId: cloudMove.id, status: cloudMove.status })
        .from(cloudMove)
        .where(ne(cloudMove.status, "failed"));
      for (const move of moves.filter((each) => each.status !== "moved"))
        await launcher.start(cloudMoveId(move.moveId), { orgId: move.orgId, moveId: move.moveId });
    },
  };
}
