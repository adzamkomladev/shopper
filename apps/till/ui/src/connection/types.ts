import { type HostStatus } from "@shopper/sync/bridge";

export type HostConnection = "disconnected" | "connecting" | "connected";
export type ConnectionSnapshot = {
  host: HostConnection;
  status: HostStatus | null;
  error: string | null;
  /** The host has no identity yet, so the till must be enrolled first; this is the server it would enrol with. */
  unenrolled?: false | EnrolServer;
};

/** Where an unenrolled till enrols: a box on its LAN (pinned) or the cloud. */
export type EnrolServer = { address: string; box: boolean };
