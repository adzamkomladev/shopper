import type { kybNotices } from "./schemas/base";

/** What the checks need besides the case: the settlement codes Paystack accepts, and each asset's verified bytes. */
export type KybEvidence = {
  banks: ReadonlySet<string>;
  /** True for an asset that resolves in the shop and whose bytes still match its registered size and digest. */
  verified: (assetId: string) => Promise<boolean>;
  today: string;
};

export type KybNotice = (typeof kybNotices)[number];
