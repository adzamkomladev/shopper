import type { relayBox } from "@shopper/db-pg";

/** A box's enrolment with its relay org. */
export type RelayBox = typeof relayBox.$inferSelect;
