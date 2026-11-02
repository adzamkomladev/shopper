import type { CommandContext } from "@shopper/audit";
import type { ShopperTransaction } from "@shopper/db-pg";
import { sub, type Money } from "@shopper/money";
import { negate, postEntry } from "./post";

/** Posts one settled MoMo payment: the bank gets the net, the fee is an expense, and the clearing account empties. */
export function postSettlement(
  tx: ShopperTransaction,
  ctx: CommandContext,
  line: { id: string; amount: Money; fee: Money; branchId: string; settledOn: string },
) {
  return postEntry(tx, ctx, {
    source: "settlement",
    sourceId: line.id,
    occurredAt: new Date(`${line.settledOn}T12:00:00Z`),
    branchId: line.branchId,
    memo: "MoMo settlement",
    lines: [
      { account: "bank", amount: sub(line.amount, line.fee) },
      { account: "fees", amount: line.fee },
      { account: "momo_clearing", amount: negate(line.amount) },
    ],
  });
}
