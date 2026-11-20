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
 * The box's Publisher to its relay org (v1.5): one loop per org. `relaunch` starts it where switched on, on boot and
 * every minute: each run publishes what is due, then beats (Day 49).
 */
export function boxRelayPublisher(deps: RelayPublisherDeps, launch: Launch = memoryLaunch) {
  const flows = launch(
    "relay-publisher",
    relayPublisherParams,
    (flow, params) => runRelayPublisher(flow, deps, params),
    { loop: true },
  );
  return {
    ...flows,
    async relaunch() {
      const rows = await deps.withDatabase((db) =>
        db.select({ id: org.id }).from(org).where(eq(org.onlineOrders, true)),
      );
      for (const row of rows) await flows.start(row.id, { orgId: row.id });
    },
  };
}
