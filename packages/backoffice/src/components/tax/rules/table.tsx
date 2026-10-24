import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { bpsToPercent } from "../../../lib/rate";
import type { RuleRow, TaxRuleView } from "../../../schemas/tax/rules";

const FROM_MD = "hidden md:table-cell";

/** Each rule's place in time on `today` (a shop date): the latest started one is in force. */
export function ruleRows(rules: TaxRuleView[], today: string): RuleRow[] {
  const current = rules.find((rule) => rule.effectiveFrom <= today);
  return rules.map((rule) => ({
    ...rule,
    status: rule.effectiveFrom > today ? "scheduled" : rule === current ? "current" : "past",
  }));
}

const STATUS = {
  scheduled: <Badge variant="outline">Scheduled</Badge>,
  current: <Badge>In force</Badge>,
  past: <Badge variant="secondary">Past</Badge>,
};
const rate = (bps: number) => `${bpsToPercent(bps)}%`;

type Props = {
  rows: RuleRow[];
  /** Offered only for scheduled rules, to members who may change rates. */
  onEdit?: (rule: RuleRow, trigger: string) => void;
  onRemove?: (rule: RuleRow, trigger: string) => void;
};

/** The dated rules, newest first, with what each charges and whether it is in force. */
export function RulesTable({ rows, onEdit, onRemove }: Props) {
  const columns: DataTableColumn<RuleRow>[] = [
    {
      id: "from",
      header: "Starts",
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium tabular-nums">{row.original.effectiveFrom}</span>
          <span className="md:hidden">{STATUS[row.original.status]}</span>
        </div>
      ),
    },
    {
      id: "vat",
      header: "VAT",
      meta: { align: "right" },
      cell: ({ row }) => rate(row.original.vatBps),
    },
    {
      id: "nhil",
      header: "NHIL",
      meta: { align: "right", className: FROM_MD },
      cell: ({ row }) => rate(row.original.nhilBps),
    },
    {
      id: "getfund",
      header: "GETFund",
      meta: { align: "right", className: FROM_MD },
      cell: ({ row }) => rate(row.original.getfundBps),
    },
    {
      id: "covid",
      header: "COVID-19",
      meta: { align: "right", className: FROM_MD },
      cell: ({ row }) => rate(row.original.covidBps),
    },
    {
      id: "source",
      header: "Source",
      meta: { className: `${FROM_MD} whitespace-normal` },
      cell: ({ row }) => row.original.source,
    },
    {
      id: "status",
      header: "Status",
      meta: { className: FROM_MD },
      cell: ({ row }) => STATUS[row.original.status],
    },
    {
      id: "actions",
      header: "Actions",
      meta: { align: "right" },
      cell: ({ row }) =>
        row.original.status === "scheduled" && onEdit && onRemove ? (
          <div className="flex justify-end gap-2">
            <Button
              id={`edit-${row.original.id}`}
              size="sm"
              variant="outline"
              onClick={() => onEdit(row.original, `edit-${row.original.id}`)}
            >
              Edit<span className="sr-only"> rates from {row.original.effectiveFrom}</span>
            </Button>
            <Button
              id={`remove-${row.original.id}`}
              size="sm"
              variant="ghost"
              onClick={() => onRemove(row.original, `remove-${row.original.id}`)}
            >
              Remove<span className="sr-only"> rates from {row.original.effectiveFrom}</span>
            </Button>
          </div>
        ) : null,
    },
  ];
  return <DataTable label="Tax rates" columns={columns} data={rows} getRowId={(row) => row.id} />;
}
