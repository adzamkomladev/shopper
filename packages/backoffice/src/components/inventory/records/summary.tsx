import { money } from "@shopper/money";
import { Money } from "@shopper/ui/components/money";
import { CAUSE_LABELS } from "../../../lib/inventory/records";
import { shiftTime } from "../../../lib/shifts/format";
import type { RecordDetail } from "../../../queries/inventory/types";
import { Stat } from "../stat";

const Value = ({ children }: { children: React.ReactNode }) => (
  <p className="text-lg font-semibold wrap-break-word">{children}</p>
);
const None = ({ children }: { children: React.ReactNode }) => (
  <p className="text-lg font-semibold text-muted-foreground">{children}</p>
);

/** What a stock change did to the sign of its lines, in words: found stock adds and wastage removes. */
const effect = (record: RecordDetail) =>
  record.lines.every((line) => line.quantityThousandths > 0)
    ? "Adds stock"
    : record.lines.every((line) => line.quantityThousandths < 0)
      ? "Removes stock"
      : "Adds and removes";

/** The cards above the items: who and when, where from, and what a delivery cost (Figma "Purchase #10482"). */
export function RecordSummary({ record }: { record: RecordDetail }) {
  const by = (verb: string) => (
    <Stat label={`${verb} by`}>
      <div>
        <Value>{record.actorName}</Value>
        <p className="text-sm text-muted-foreground">{shiftTime(record.occurredAt)}</p>
      </div>
    </Stat>
  );
  const cards =
    record.kind === "receipt"
      ? [
          <Stat key="supplier" label="Supplier">
            {record.supplierName ? <Value>{record.supplierName}</Value> : <None>Not named</None>}
          </Stat>,
          <Stat key="reference" label="Reference">
            {record.reference ? <Value>{record.reference}</Value> : <None>None</None>}
          </Stat>,
          by("Received"),
          <Stat key="cost" label="Total cost">
            {record.totalCost === null ? (
              <None>No cost recorded</None>
            ) : (
              <Money amount={money(record.totalCost)} className="text-left text-lg font-semibold" />
            )}
          </Stat>,
        ]
      : record.kind === "adjustment"
        ? [
            <Stat key="cause" label="Cause">
              <Value>{record.cause ? (CAUSE_LABELS[record.cause] ?? record.cause) : "—"}</Value>
            </Stat>,
            <Stat key="effect" label="Effect">
              <Value>{effect(record)}</Value>
            </Stat>,
            by("Adjusted"),
          ]
        : [
            <Stat key="counted" label="Products counted">
              <Value>{record.lineCount}</Value>
            </Stat>,
            by("Counted"),
          ];
  return (
    <div
      className={`grid grid-cols-2 gap-4 ${cards.length === 4 ? "lg:grid-cols-4" : cards.length === 3 ? "lg:grid-cols-3" : ""}`}
    >
      {cards}
    </div>
  );
}
