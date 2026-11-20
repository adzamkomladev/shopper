import { eq } from "drizzle-orm";
import { org } from "@shopper/db-pg";
import {
  publishPending,
  relayPublisherParams,
  runRelayPublisher,
  type RelayPublisherDeps,
} from "@shopper/core/relay";
import type { Launch } from "../types";
import { memoryLaunch } from "./launch";

/**
 * The box's Publisher to its relay org (v1.5): one loop per org. `relaunch` on boot starts it where switched on;
 * `beat`, every minute, first publishes what is due (stock that moved without a wake, a held-back rise) and only then,
 * when that went through, tells the relay the box is alive: a reconnecting box never reopens ordering on stale stock,
 * and one whose publishes keep failing stays paused.
 */
export function boxRelayPublisher(deps: RelayPublisherDeps, launch: Launch = memoryLaunch) {
  const flows = launch(
    "relay-publisher",
    relayPublisherParams,
    (flow, params) => runRelayPublisher(flow, deps, params),
    { loop: true },
  );
  const online = () =>
    deps.withDatabase((db) =>
      db.select({ id: org.id }).from(org).where(eq(org.onlineOrders, true)),
    );
  return {
    ...flows,
    async relaunch() {
      for (const row of await online()) await flows.start(row.id, { orgId: row.id });
    },
    async beat() {
      for (const row of await online()) {
        const context = { orgId: row.id, appVersion: deps.appVersion };
        // A missed beat is only liveness: the next one, a minute on, makes up for it.
        await deps
          .withDatabase((db) => publishPending(db, context, deps))
          .then(async (result) => {
            if ("refused" in result || "off" in result) return;
            const beat = await deps.send("/relay/heartbeat", { method: "POST", body: "{}" });
            if (!beat.ok) throw new Error(`The relay answered ${beat.status}`);
          })
          .catch((error: unknown) => console.error({ event: "relay.beat_failed", error }));
      }
    },
  };
}
