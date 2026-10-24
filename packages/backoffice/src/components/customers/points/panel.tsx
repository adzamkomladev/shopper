import { useQuery } from "@tanstack/react-query";
import { CoinsIcon } from "lucide-react";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { dayTime, POINTS_LABELS } from "../../../lib/customers/format";
import { customerLoyaltyQuery } from "../../../queries/customers/account";
import type { CustomerLoyalty } from "../../../schemas/customers/account";
import { EmptyList, ReadOnlyNote } from "../../admin/states";
import { QueryPanel } from "../detail/panel";

type Entry = CustomerLoyalty["entries"][number];

const signed = (points: number) => (points > 0 ? `+${points}` : String(points));

const columns: DataTableColumn<Entry>[] = [
  {
    id: "date",
    header: "Date",
    cell: ({ row }) => <span className="tabular-nums">{dayTime(row.original.occurredAt)}</span>,
  },
  {
    id: "reason",
    header: "What happened",
    cell: ({ row }) => POINTS_LABELS[row.original.reason] ?? row.original.reason,
  },
  {
    id: "points",
    header: "Points",
    meta: { align: "right" },
    cell: ({ row }) => <span className="tabular-nums">{signed(row.original.points)}</span>,
  },
  {
    id: "balance",
    header: "Balance",
    meta: { align: "right" },
    cell: ({ row }) => <span className="font-medium tabular-nums">{row.original.balance}</span>,
  },
];

/** Every change to their points, newest first, with the balance after it. */
export function PointsPanel({ customerId }: { customerId: string }) {
  const query = useQuery(customerLoyaltyQuery(customerId));
  return (
    <QueryPanel query={query} what="points history">
      {({ entries, enabled }) => (
        <>
          {!enabled && (
            <ReadOnlyNote>
              Loyalty is switched off, so no new points are earned. What they hold stays on the
              account.
            </ReadOnlyNote>
          )}
          {entries.length === 0 ? (
            <EmptyList
              icon={CoinsIcon}
              title="No points yet"
              description="Points are earned on sales and show here with the balance after each."
            />
          ) : (
            <DataTable
              label="Points history"
              columns={columns}
              data={[...entries].reverse()}
              getRowId={(entry) => entry.id}
              className="max-h-96"
            />
          )}
        </>
      )}
    </QueryPanel>
  );
}
