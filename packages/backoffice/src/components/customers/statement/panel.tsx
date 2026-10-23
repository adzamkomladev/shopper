import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Field, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input";
import { thisMonth, validRange } from "../../../lib/customers/range";
import type { Range } from "../../../lib/customers/types";
import { statementQuery } from "../../../queries/customers/account";
import type { CustomerView } from "../../../queries/customers/types";
import { QueryPanel } from "../detail/panel";
import { StatementActions } from "./actions";
import { ActiveLinks, Deliveries } from "./history";
import { StatementTable } from "./table";

type Props = { customer: CustomerView; canManage: boolean };

/** The account between two days with a running balance, ways to share it, its open links and what was sent. */
export function StatementPanel({ customer, canManage }: Props) {
  const [range, setRange] = useState<Range>(() => thisMonth());
  const valid = validRange(range);
  const query = useQuery({
    ...statementQuery(customer.id, range.from, range.to),
    enabled: valid,
  });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="flex flex-wrap items-start gap-4">
          <DayField
            label="From"
            value={range.from}
            onChange={(from) => setRange({ ...range, from })}
          />
          <DayField
            label="To"
            value={range.to}
            onChange={(to) => setRange({ ...range, to })}
            invalid={!valid}
          />
        </div>
        {canManage && (
          <StatementActions
            customerId={customer.id}
            email={customer.email}
            range={range}
            ready={valid}
          />
        )}
      </div>
      {valid ? (
        <QueryPanel query={query} what="the statement">
          {(statement) => <StatementTable statement={statement} />}
        </QueryPanel>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <ActiveLinks customerId={customer.id} canManage={canManage} />
        <Deliveries customerId={customer.id} />
      </div>
    </div>
  );
}

type DayProps = {
  label: string;
  value: string;
  onChange: (day: string) => void;
  invalid?: boolean;
};

function DayField({ label, value, onChange, invalid }: DayProps) {
  const id = `statement-${label.toLowerCase()}`;
  return (
    <Field data-invalid={invalid} className="w-auto">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="date"
        value={value}
        aria-invalid={invalid}
        aria-describedby={invalid ? "statement-range-error" : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {invalid && (
        <FieldError id="statement-range-error">
          Pick a start on or before the end, no more than a year apart.
        </FieldError>
      )}
    </Field>
  );
}
