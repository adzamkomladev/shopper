import { Money } from "@shopper/ui/components/money";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopper/ui/components/table";
import { money } from "@shopper/money";
import type { AmountRow, BalanceView, ProfitView, TrialView } from "../../../schemas/ledger/views";

/** Every account with a balance at the day, debit or credit, and the two totals that must agree. */
export function TrialTable({ data }: { data: TrialView }) {
  return (
    <Table scrollable aria-label="Trial balance">
      <TableHeader>
        <TableRow>
          <TableHead>Account</TableHead>
          <TableHead className="text-right">Debit</TableHead>
          <TableHead className="text-right">Credit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.rows.map((row) => (
          <TableRow key={row.accountId}>
            <TableCell className="whitespace-normal">
              <span className="tabular-nums text-muted-foreground">{row.code}</span> {row.name}
            </TableCell>
            <TableCell>{row.debit > 0 && <Money amount={money(row.debit)} />}</TableCell>
            <TableCell>{row.credit > 0 && <Money amount={money(row.credit)} />}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="font-semibold">Total</TableCell>
          <TableCell className="font-semibold">
            <Money amount={money(data.totals.debit)} />
          </TableCell>
          <TableCell className="font-semibold">
            <Money amount={money(data.totals.credit)} />
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

export function ProfitTable({ data }: { data: ProfitView }) {
  return (
    <Table scrollable aria-label="Profit and loss">
      <Header />
      <TableBody>
        <Section title="Income" rows={data.income} total={data.totals.income} />
        <Section title="Expenses" rows={data.expenses} total={data.totals.expenses} />
      </TableBody>
      <Footer label="Net profit" amount={data.totals.net} />
    </Table>
  );
}

export function BalanceTable({ data }: { data: BalanceView }) {
  return (
    <Table scrollable aria-label="Balance sheet">
      <Header />
      <TableBody>
        <Section title="Assets" rows={data.assets} total={data.totals.assets} />
        <Section title="Liabilities" rows={data.liabilities} />
        <Section
          title="Equity"
          rows={[
            ...data.equity,
            {
              accountId: "earnings",
              code: "",
              name: "Current earnings",
              type: "equity",
              systemKey: null,
              amount: data.earnings,
            },
          ]}
        />
      </TableBody>
      <Footer label="Liabilities and equity" amount={data.totals.liabilitiesAndEquity} />
    </Table>
  );
}

const Header = () => (
  <TableHeader>
    <TableRow>
      <TableHead>Account</TableHead>
      <TableHead className="text-right">Amount</TableHead>
    </TableRow>
  </TableHeader>
);

const Footer = ({ label, amount }: { label: string; amount: number }) => (
  <TableFooter>
    <TableRow>
      <TableCell className="font-semibold">{label}</TableCell>
      <TableCell className="font-semibold">
        <Money amount={money(amount)} />
      </TableCell>
    </TableRow>
  </TableFooter>
);

function Section({ title, rows, total }: { title: string; rows: AmountRow[]; total?: number }) {
  return (
    <>
      <TableRow className="hover:bg-transparent">
        <TableHead scope="rowgroup" colSpan={2} className="text-foreground">
          {title}
        </TableHead>
      </TableRow>
      {rows.map((row) => (
        <TableRow key={row.accountId}>
          <TableCell className="whitespace-normal pl-8">
            <span className="tabular-nums text-muted-foreground">{row.code}</span> {row.name}
          </TableCell>
          <TableCell>
            <Money amount={money(row.amount)} />
          </TableCell>
        </TableRow>
      ))}
      {total !== undefined && (
        <TableRow>
          <TableCell className="font-medium">Total {title.toLowerCase()}</TableCell>
          <TableCell className="font-medium">
            <Money amount={money(total)} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
