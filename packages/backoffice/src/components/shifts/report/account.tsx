import { formatGHS, money } from "@shopper/money";
import type { XReport } from "@shopper/core/schemas";
import { Row } from "./cash";

const cedis = (amount: number) => formatGHS(money(amount));

/** What went through customers' accounts in the shift; the cash paid in is already part of the drawer. */
export function AccountLines({ account }: { account: XReport["account"] }) {
  const { payments } = account;
  return (
    <dl className="grid gap-2 p-4 text-sm">
      <Row label="On-account sales" value={cedis(account.sales)} />
      <Row label="Account payments" value={cedis(payments.cash + payments.momo)} />
      <Row label="Paid in cash" value={cedis(payments.cash)} />
      <Row label="Paid by mobile money" value={cedis(payments.momo)} />
      <Row label="Refunds to accounts" value={cedis(account.refunds)} />
      <Row label={`Points redeemed (${account.points})`} value={cedis(account.pointsValue)} />
    </dl>
  );
}
