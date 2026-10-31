import type { TillDatabase } from "@shopper/db-sqlite";

export type PushStatus = {
  server: "connecting" | "online" | "offline" | "blocked" | "revoked" | "incompatible";
  pendingCount: number;
  blockedCount: number;
  lastError: { code: string; message: string } | null;
  lastSuccessfulPushAt: number | null;
};
export type PushOptions = {
  database: TillDatabase;
  config: {
    orgId: string;
    storeId?: string;
    deviceId: string;
    appVersion: string;
    protocol: number;
    upstream: string;
    deviceToken: string;
  };
  now?: () => number;
  random?: () => number;
  timeoutMs?: number;
  onStatus?: (status: PushStatus) => void;
  onAcknowledgment?: () => void;
  /** A handshake measured the register clock against the server's: register minus server, in ms. */
  onClockMeasured?: (offsetMs: number) => void;
  /** What the last handshake said about updates: the minimum till version and this org's channel. */
  onHandshake?: (release: {
    minTillVersion?: string | null;
    updateChannel?: "pilot" | "stable";
  }) => void;
};
