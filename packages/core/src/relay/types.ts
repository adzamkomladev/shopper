import type { relayProjection } from "./projection";
import type { relayBox } from "@shopper/db-pg";

/** A box's enrolment with its relay org. */
export type RelayBox = typeof relayBox.$inferSelect;

/** The rows a box publishes to its relay org, as both sides read them. */
export type RelayProjection = Awaited<ReturnType<typeof relayProjection>>;

/** A licence-signed request to the cloud's relay; the box's shell signs it. */
export type RelaySend = (
  path: string,
  init: { method: string; body?: string },
) => Promise<Response>;
