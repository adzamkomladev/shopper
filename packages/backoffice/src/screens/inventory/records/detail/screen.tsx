import { Link, useParams } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { RecordItems } from "../../../../components/inventory/records/items";
import { RecordSkeleton } from "../../../../components/inventory/records/skeleton";
import { RecordSummary } from "../../../../components/inventory/records/summary";
import { Gate } from "../../../../components/register/states";
import { focusOnMount } from "../../../../lib/focus";
import { RECORD_TITLES } from "../../../../lib/inventory/records";
import { shiftTime } from "../../../../lib/shifts/format";
import { recordQuery } from "../../../../queries/inventory/records";

/** One receipt, adjustment or count: who recorded it and when, and the products it moved. */
export function RecordScreen() {
  return (
    <Gate need="stock.read" what="stock records" fallback={<RecordSkeleton />}>
      <Record />
    </Gate>
  );
}

function Record() {
  const { documentId } = useParams({ from: "/_shop/stock/records/$documentId" });
  const { data: record } = useSuspenseQuery(recordQuery(documentId));
  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="flex flex-col gap-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-3 self-start text-muted-foreground"
        >
          <Link to="/stock/records" search={{ branch: record.branchId }}>
            <ArrowLeftIcon aria-hidden />
            Back to records
          </Link>
        </Button>
        <div className="flex flex-col gap-1">
          {/* Focused on arrival, so a screen reader starts at the record and Back is one Shift+Tab away. */}
          <h1
            tabIndex={-1}
            ref={focusOnMount}
            className="text-3xl font-bold tracking-tight wrap-break-word outline-none"
          >
            {RECORD_TITLES[record.kind]}
          </h1>
          <p className="text-sm text-muted-foreground">
            {record.branchName} · {shiftTime(record.occurredAt)}
          </p>
        </div>
      </div>
      <RecordSummary record={record} />
      <RecordItems record={record} />
    </div>
  );
}
