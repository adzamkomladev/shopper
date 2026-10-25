import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import { auditAnchorParams, runAuditAnchor } from "@shopper/core/audit";
import type { ShopperDatabase } from "@shopper/db-pg";
import {
  memoryWorkflow,
  workflowInstanceIdSchema,
  type Queue,
  type WorkflowLauncher,
} from "@shopper/ports";

// ponytail: in-process, so an anchor interrupted by a restart waits for the next day's; Rivet Workflows take over on
// Day 36.
/** The box shell for the daily audit anchor; `idle` settles once every started anchor has finished. */
export function boxAuditAnchors(options: { database: ShopperDatabase; queue?: Queue }) {
  const running = new Map<string, Promise<void>>();
  const deps = {
    withDatabase: <T>(run: (db: ShopperDatabase) => Promise<T>) => run(options.database),
    appVersion: buildInfo.version,
    queue: options.queue,
  };
  const launcher: WorkflowLauncher = {
    send: async (id) => void v.parse(workflowInstanceIdSchema, id),
    async start(instanceId, params) {
      v.parse(workflowInstanceIdSchema, instanceId);
      v.parse(auditAnchorParams, params);
      if (running.has(instanceId)) return;
      running.set(
        instanceId,
        runAuditAnchor(memoryWorkflow(instanceId), deps, params).catch((error: unknown) => {
          running.delete(instanceId);
          console.error({ event: "audit.anchor_failed", instanceId, error });
        }),
      );
    },
  };
  return { launcher, idle: async () => void (await Promise.all(running.values())) };
}

const DAY_MS = 86_400_000;
/** The watchdog's minute of the day: 23:59 UTC, the cron Cloudflare runs. */
const WATCH_AT_MS = DAY_MS - 60_000;

/** The box's one daily watchdog: a timer to the next 23:59 UTC that re-arms itself after each firing. */
export function boxWatchdog(fire: (at: Date) => Promise<void>) {
  let timer: ReturnType<typeof setTimeout>;
  const arm = () => {
    const now = Date.now();
    const today = now - (now % DAY_MS) + WATCH_AT_MS;
    const next = today > now ? today : today + DAY_MS;
    timer = setTimeout(() => {
      fire(new Date(next))
        .catch((error: unknown) => console.error({ event: "watchdog.failed", error }))
        .finally(arm);
    }, next - now);
    timer.unref?.();
  };
  arm();
  return { stop: () => clearTimeout(timer) };
}
