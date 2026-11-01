import { Suspense } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Label } from "@shopper/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@shopper/ui/components/radio-group";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { Gate, OfflineNote } from "../../../components/register/states";
import {
  NothingTaxed,
  SummaryResultsSkeleton,
  SummarySkeleton,
} from "../../../components/tax/states";
import { SummaryTable, SummaryTotals } from "../../../components/tax/summary/table";
import { TaxPage } from "../../../components/tax/tabs";
import { shopToday } from "../../../lib/tax/dates";
import { taxSummaryQuery } from "../../../queries/tax/returns";
import { DatePicker } from "@shopper/ui/components/picker/date";

/** Tax charged and given back, by period, branch and class, over a range of shop dates. */
export function TaxSummaryScreen() {
  return (
    <TaxPage active="summary">
      <Gate need="tax.read" what="the tax summary" fallback={<SummarySkeleton />}>
        <SummaryBody />
      </Gate>
    </TaxPage>
  );
}

function SummaryBody() {
  const search = useSearch({ from: "/_shop/tax" });
  const navigate = useNavigate();
  const online = useOnline();
  const today = shopToday();
  const range = {
    from: search.from ?? `${today.slice(0, 7)}-01`,
    to: search.to ?? today,
    group: search.group ?? "day",
  };
  const go = (change: Partial<typeof range>) =>
    void navigate({ to: "/tax", search: { ...range, ...change }, replace: true });
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {!online && (
        <OfflineNote>
          You're seeing figures loaded earlier. New sales show when you're back online.
        </OfflineNote>
      )}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tax-from">From</Label>
          <DatePicker
            id="tax-from"
            value={range.from}
            max={range.to}
            onValueChange={(value) => value && go({ from: value })}
            className="w-44"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tax-to">To</Label>
          <DatePicker
            id="tax-to"
            value={range.to}
            min={range.from}
            onValueChange={(value) => value && go({ to: value })}
            className="w-44"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label id="tax-group">Group by</Label>
          <RadioGroup
            aria-labelledby="tax-group"
            value={range.group}
            onValueChange={(group) => go({ group: group as "day" | "month" })}
            className="flex h-9 items-center gap-4"
          >
            {(["day", "month"] as const).map((group) => (
              <div key={group} className="flex items-center gap-2">
                <RadioGroupItem id={`tax-group-${group}`} value={group} />
                <Label htmlFor={`tax-group-${group}`} className="font-normal">
                  {group === "day" ? "Day" : "Month"}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </div>
      <Suspense fallback={<SummaryResultsSkeleton />}>
        <SummaryResults range={range} />
      </Suspense>
    </div>
  );
}

function SummaryResults({
  range,
}: {
  range: { from: string; to: string; group: "day" | "month" };
}) {
  const { data } = useSuspenseQuery(taxSummaryQuery(range));
  if (data.rows.length === 0) return <NothingTaxed what={`${range.from} to ${range.to}`} />;
  return (
    <>
      <SummaryTotals rows={data.rows} />
      <SummaryTable rows={data.rows} />
    </>
  );
}
