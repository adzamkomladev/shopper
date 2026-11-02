import type { CommandContext } from "@shopper/audit";
import type { ShopperTransaction } from "@shopper/db-pg";
import { money } from "@shopper/money";
import type { ShiftClosedEvent } from "../schemas/till/shift";
import { tenderAccounts } from "./accounts";
import { negate, postEntry } from "./post";

type Report = ShiftClosedEvent["shift"]["report"];

/**
 * Posts a closed shift: each cash drop moves from the drawer to the safe, and each tender's counted variance
 * (declared minus expected) lands in cash over/short against that tender's account. Sales are already posted.
 */
export function postShift(tx: ShopperTransaction, ctx: CommandContext, report: Report) {
  const drops = report.movements.filter((movement) => movement.kind === "drop");
  return postEntry(tx, ctx, {
    source: "shift",
    sourceId: report.shiftId,
    occurredAt: new Date(report.closedAt),
    branchId: report.branchId,
    memo: `Shift close ${report.registerName ?? ""}`.trim(),
    lines: [
      ...drops.flatMap((drop) => [
        { account: "cash_safe" as const, amount: money(drop.amount) },
        { account: "cash_drawer" as const, amount: negate(money(drop.amount)) },
      ]),
      ...report.variances.flatMap((line) => [
        { account: tenderAccounts[line.tender], amount: money(line.variance) },
        { account: "over_short" as const, amount: negate(money(line.variance)) },
      ]),
    ],
  });
}
