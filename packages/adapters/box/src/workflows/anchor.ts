import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import { auditAnchorParams, runAuditAnchor } from "@shopper/core/audit";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { Queue } from "@shopper/ports";
import { watchParams } from "../schemas/workflows";
import type { Launch } from "../types";
import { memoryLaunch } from "./launch";

/** The box shell for the daily audit anchor; `idle` settles once every started anchor has finished (memory engine). */
export function boxAuditAnchors(
  options: { database: ShopperDatabase; queue?: Queue },
  launch: Launch = memoryLaunch,
) {
  const deps = {
    withDatabase: <T>(run: (db: ShopperDatabase) => Promise<T>) => run(options.database),
    appVersion: buildInfo.version,
    queue: options.queue,
  };
  const launcher = launch("audit-anchor", auditAnchorParams, (flow, params) =>
    runAuditAnchor(flow, deps, params),
  );
  return { launcher, idle: launcher.idle };
}

const DAY_MS = 86_400_000;
/** The watchdog's minute of the day: 23:59 UTC, the cron Cloudflare runs. */
const WATCH_AT_MS = DAY_MS - 60_000;

const firstTry = { maxAttempts: 1, delayMs: 0, backoff: "constant" } as const;

/**
 * The box's one daily watchdog at 23:59 UTC. Each day is a one-shot workflow that sleeps until then, fires and
 * starts the next day's, so on Rivet a missed firing runs on the next boot. Starting it on every boot is safe.
 */
export function boxWatchdog(fire: (at: Date) => Promise<void>, launch: Launch = memoryLaunch) {
  const launcher = launch("watchdog", watchParams, async (flow, params) => {
    const at = new Date(v.parse(watchParams, params).at);
    await flow.sleepUntil("due", at);
    // A failed firing is logged; the next day is still watched.
    await flow
      .step("fire", firstTry, async () => {
        await fire(at);
        return null;
      })
      .catch((error: unknown) => console.error({ event: "watchdog.failed", error }));
    await flow.step("next", firstTry, async () => {
      await watch(new Date(at.getTime() + DAY_MS));
      return null;
    });
  });
  const watch = (at: Date) =>
    launcher.start(`watchdog_${at.toISOString().slice(0, 10)}`, { at: at.toISOString() });
  const now = Date.now();
  const today = now - (now % DAY_MS) + WATCH_AT_MS;
  return watch(new Date(today > now ? today : today + DAY_MS));
}
