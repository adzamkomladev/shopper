import type { Realtime } from "@shopper/ports";

export interface RealtimeFixture {
  orgId: string;
  otherOrgId: string;
  storeId: string;
  realtime: Realtime;
}
