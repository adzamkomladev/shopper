import { buildInfo } from "@shopper/config";
import { boxRelayPublisher, type Launch } from "@shopper/adapters-box";
import type { BoxLicence } from "@shopper/api";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { Blobs } from "@shopper/ports";

const HEARTBEAT_MS = 60_000;

/**
 * The Publisher to the shop's relay org (v1.5), for a licensed box that knows where Shopper is
 * (`SHOPPER_LICENCE_URL`): every request goes out signed with the box's licence key; product photos are read from
 * the box's storage. On boot it starts again where
 * Online Orders is on, so changes made while it was down go up. Every minute it beats: the relay pauses a branch's
 * online ordering after 5 minutes of silence in opening hours (v1.5 Day 49); each run publishes what is due first.
 */
export function bootRelayPublisher(
  environment: Record<string, string | undefined>,
  licence: BoxLicence | undefined,
  database: ShopperDatabase,
  launch: Launch,
  blobs: () => Promise<Blobs>,
) {
  const server = environment.SHOPPER_LICENCE_URL;
  if (!licence || !server) return undefined;
  const publisher = boxRelayPublisher(
    {
      withDatabase: (run) => run(database),
      appVersion: buildInfo.version,
      blobs,
      send: (path, init) => licence.send(new URL(path, server).toString(), init),
    },
    launch,
  );
  publisher
    .relaunch()
    .catch((error: unknown) => console.error({ event: "relay.relaunch_failed", error }));
  // The heartbeat's clock. Liveness, not business logic: a plain timer starting a run that ends, not a forever loop.
  setInterval(() => {
    publisher
      .relaunch()
      .catch((error: unknown) => console.error({ event: "relay.beat_failed", error }));
  }, HEARTBEAT_MS).unref();
  return publisher;
}
