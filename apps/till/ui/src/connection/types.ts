import { type HostStatus } from "@shopper/sync/bridge";

export type HostConnection = "disconnected" | "connecting" | "connected";
export type ConnectionSnapshot = {
  host: HostConnection;
  status: HostStatus | null;
  error: string | null;
  /** The host has no identity yet: the till must be enrolled before anything else. */
  unenrolled?: boolean;
};
