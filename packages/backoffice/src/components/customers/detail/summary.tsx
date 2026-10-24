import { useQuery } from "@tanstack/react-query";
import { Badge } from "@shopper/ui/components/badge";
import { Money } from "@shopper/ui/components/money";
import { account, available, KIND_LABELS, shortDay } from "../../../lib/customers/format";
import { customerLoyaltyQuery } from "../../../queries/customers/account";
import type { CustomerView } from "../../../queries/customers/types";
import { Stat } from "../../inventory/stat";

const BIG = "text-2xl font-semibold tabular-nums";

/** What they owe (or hold as a deposit), their limit, what is left of it and their points, side by side. */
export function CustomerSummary({ customer }: { customer: CustomerView }) {
  const { label, amount } = account(customer);
  const loyalty = useQuery(customerLoyaltyQuery(customer.id)).data;
  const { projection } = loyalty ?? {};
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={label}>
          <Money amount={amount} className={`${BIG} text-left`} />
        </Stat>
        <Stat label="Credit limit">
          {customer.creditLimit > 0 ? (
            <Money amount={customer.creditLimit} className={`${BIG} text-left`} />
          ) : (
            <p className="text-2xl font-semibold text-muted-foreground">No credit</p>
          )}
        </Stat>
        <Stat label="Available">
          <Money amount={available(customer)} className={`${BIG} text-left`} />
        </Stat>
        <Stat
          label="Points"
          action={loyalty?.tier && <Badge variant="secondary">{loyalty.tier.name}</Badge>}
        >
          <p className={BIG}>{customer.points}</p>
        </Stat>
      </div>
      {projection && (
        <p className="text-sm text-muted-foreground">
          {projection.to ? `Moves to ${projection.to}` : `Loses ${projection.from}`} on{" "}
          {shortDay(projection.on)}
        </p>
      )}
    </div>
  );
}

/** Who they are: phone, type, business name, TIN and email, each as the label it answers to. */
export function CustomerDetails({ customer }: { customer: CustomerView }) {
  const rows = [
    ["Phone", customer.phone],
    ["Type", KIND_LABELS[customer.kind]],
    ["Business name", customer.businessName],
    ["TIN", customer.tin],
    ["Email", customer.email],
  ] as const;
  return (
    <dl className="grid gap-x-6 gap-y-4 rounded-lg border bg-card p-4 text-sm shadow-sm sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(([term, value]) => (
        <div key={term} className="flex min-w-0 flex-col gap-1">
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="font-medium wrap-break-word">
            {value ?? <span className="text-muted-foreground">Not given</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
