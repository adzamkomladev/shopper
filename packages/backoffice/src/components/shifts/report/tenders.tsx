import { money } from "@shopper/money";
import type { XReport, ZReport } from "@shopper/core/schemas";
import { Money } from "@shopper/ui/components/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopper/ui/components/table/primitive";
import { deduction, tenderName, varianceLabel } from "../../../lib/shifts/format";

const right = "text-right";
/** Four columns of money do not fit a phone at full size, so they tighten there instead of scrolling. */
const compact = "max-sm:text-xs max-sm:[&_td]:px-1 max-sm:[&_th]:px-1";

/** The X: what each tender took, gave back and should hold. The Z: expected against declared. */
export function TendersTable({ report }: { report: XReport | ZReport }) {
  return report.kind === "z" ? (
    <VarianceTable label="Tenders" variances={report.variances} />
  ) : (
    <ExpectedTable report={report} />
  );
}

function ExpectedTable({ report }: { report: XReport }) {
  return (
    <Table aria-label="Tenders" className={compact}>
      <TableHeader>
        <TableRow>
          <TableHead>Tender</TableHead>
          <TableHead className={right}>Sales</TableHead>
          <TableHead className={right}>Refunds</TableHead>
          <TableHead className={right}>Expected</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.tenders.map((row) => (
          <TableRow key={row.tender}>
            <TableCell>{tenderName[row.tender]}</TableCell>
            <TableCell>
              <Money amount={money(row.sales)} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{deduction(row.refunds)}</TableCell>
            <TableCell className="font-medium">
              <Money amount={money(row.expected)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** What the count found against what the register expected, per tender; also shown before the Z exists. */
export function VarianceTable({
  variances,
  label,
}: {
  variances: ZReport["variances"];
  label: string;
}) {
  return (
    <Table aria-label={label} className={compact}>
      <TableHeader>
        <TableRow>
          <TableHead>Tender</TableHead>
          <TableHead className={right}>Expected</TableHead>
          <TableHead className={right}>Declared</TableHead>
          <TableHead className={right}>Variance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {variances.map((row) => (
          <TableRow key={row.tender}>
            <TableCell>{tenderName[row.tender]}</TableCell>
            <TableCell>
              <Money amount={money(row.expected)} />
            </TableCell>
            <TableCell>
              <Money amount={money(row.declared)} />
            </TableCell>
            <TableCell
              className={`text-right font-medium tabular-nums ${row.variance < 0 ? "text-destructive" : ""}`}
            >
              {varianceLabel(row.variance)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
