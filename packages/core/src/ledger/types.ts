import type { JournalSource, SystemAccount } from "@shopper/db-pg";
import type { Money } from "@shopper/money";

/** One side of a posting: a system account by key or any account by id; debits positive, credits negative. */
export type Posting = { account: SystemAccount | { id: string }; amount: Money; memo?: string };
export type Entry = {
  source: JournalSource;
  sourceId: string;
  occurredAt: Date;
  branchId?: string | null;
  memo: string;
  lines: Posting[];
  reversesId?: string;
};
