import { eq } from "drizzle-orm";
import { org } from "@shopper/db-pg";
import {
  relayPublisherParams,
  runRelayPublisher,
  type RelayPublisherDeps,
} from "@shopper/core/relay";
import type { Launch } from "../types";
import { memoryLaunch } from "./launch";

/**
 * The box's Publisher to its relay org (v1.5): one loop per org. `relaunch` on boot starts it where switched on;
 * `beat`, every minute, tells the relay the box is alive and wakes the Publisher, so stock that moved without a wake
 * (and a held-back rise) goes up within the minute.
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
        // A missed beat is only liveness: the next one, a minute on, makes up for it.
        await deps
          .send("/relay/heartbeat", { method: "POST", body: "{}" })
          .catch((error: unknown) => console.error({ event: "relay.heartbeat_failed", error }));
        await flows.start(row.id, { orgId: row.id });
      }
    },
  };
}
