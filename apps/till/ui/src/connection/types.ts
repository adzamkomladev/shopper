import { type HostStatus } from "@shopper/sync/bridge";

export type HostConnection = "disconnected" | "connecting" | "connected";
export type ConnectionSnapshot = {
  host: HostConnection;
  status: HostStatus | null;
  error: string | null;
};
