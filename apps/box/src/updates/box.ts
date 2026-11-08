import { buildInfo } from "@shopper/config";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { BoxLicence } from "@shopper/api";
import type { Launch } from "@shopper/adapters-box";
import { backupBox } from "../backup";
import { boxUpdates } from "./service";

/**
 * The box's updates, wired to this process: its own build, its licence's maintenance date and the Day 37 backup. Undefined
 * where Shopper's release key is not built in (development): nothing could be verified, so nothing is offered.
 */
export function boxUpdatesFor(
  env: Record<string, string | undefined>,
  licence: BoxLicence | undefined,
  releaseKey = buildInfo.releaseKey,
) {
  let made: ReturnType<typeof boxUpdates> | undefined;
  return (database: ShopperDatabase, launch: Launch) =>
    releaseKey ? (made ??= build(database, launch)) : undefined;

  function build(database: ShopperDatabase, launch: Launch) {
    return boxUpdates({
      env,
      releaseKey: releaseKey,
      installed: { version: buildInfo.version, schemaVersion: buildInfo.schemaVersion },
      maintenanceUntil: async () => (await licence?.status())?.licence?.maintenanceUntil,
      backup: async () => {
        if (!env.DATABASE_URL || !env.SHOPPER_BACKUP_RECIPIENT || !env.SHOPPER_BACKUP_REMOTE)
          throw new Error("backups are not set up on this box");
        await backupBox({
          databaseUrl: env.DATABASE_URL,
          recipient: env.SHOPPER_BACKUP_RECIPIENT,
          remote: env.SHOPPER_BACKUP_REMOTE,
          workDir: env.SHOPPER_BACKUP_DIR ?? ".shopper/backups",
          keep: preUpdateDump(env),
        });
      },
      withDatabase: (run) => run(database),
      launch,
    });
  }
}

/** The verified dump taken before an update, which a rollback restores when the update's migrations ran. */
export const preUpdateDump = (env: Record<string, string | undefined>) =>
  `${env.SHOPPER_UPDATES_DIR ?? ".shopper/updates"}/pre-update.dump`;
