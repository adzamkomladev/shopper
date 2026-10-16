import type { Realtime } from "@shopper/ports";

export interface RealtimeFixture {
  orgId: string;
  otherOrgId: string;
  storeId: string;
  realtime: Realtime;
}

export type MomoFixture = {
  start(phone: string): Promise<string>;
  otp(reference: string, otp: string): Promise<void>;
  retry(reference: string, phone: string): Promise<boolean>;
  chargeCount(reference: string): Promise<number>;
  status(reference: string): Promise<string>;
  run(reference: string): Promise<{ businessKey: string; status: string }>;
  close(): Promise<void>;
};
