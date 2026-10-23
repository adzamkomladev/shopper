import type { Money } from "@shopper/money";
import type { pointLots } from "../loyalty/points";

export interface AccountState {
  /** Archived (merged customers are archived too): nothing more is posted. */
  archived: boolean;
  credit: readonly { kind: string; amount: Money; occurredAt: Date }[];
  points: Parameters<typeof pointLots>[0];
  /** When the next tier notice falls due, from the projection; null when none is. */
  noticeAt: Date | null;
}
export interface AccountSettings {
  interestBps: number;
  termsDays: number;
  loyaltyEnabled: boolean;
  expiryDays: number;
}
