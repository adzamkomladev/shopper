import { buildInfo } from "@shopper/config";
import { boxRelayPublisher, type Launch } from "@shopper/adapters-box";
import type { BoxLicence } from "@shopper/api";
import type { ShopperDatabase } from "@shopper/db-pg";

/**
 * The Publisher to the shop's relay org (v1.5), for a licensed box that knows where Shopper is
 * (`SHOPPER_LICENCE_URL`): every request goes out signed with the box's licence key. On boot it starts again where
 * Online Orders is on, so changes made while it was down go up.
 */
export function bootRelayPublisher(
  environment: Record<string, string | undefined>,
  licence: BoxLicence | undefined,
  database: ShopperDatabase,
  launch: Launch,
) {
  const server = environment.SHOPPER_LICENCE_URL;
  if (!licence || !server) return undefined;
  const publisher = boxRelayPublisher(
    {
      withDatabase: (run) => run(database),
      appVersion: buildInfo.version,
      send: (path, init) => licence.send(new URL(path, server).toString(), init),
    },
    launch,
  );
  publisher
    .relaunch()
    .catch((error: unknown) => console.error({ event: "relay.relaunch_failed", error }));
  return publisher;
}
