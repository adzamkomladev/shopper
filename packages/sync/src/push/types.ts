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
};
