import { Suspense } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shopper/ui/components/tabs";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { LedgerRange } from "../../../components/ledger/range";
import { LinesSkeleton, NothingPosted, RangeSkeleton } from "../../../components/ledger/states";
import {
  BalanceTable,
  ProfitTable,
  TrialTable,
} from "../../../components/ledger/statements/tables";
import { LedgerPage } from "../../../components/ledger/tabs";
import { Gate } from "../../../components/register/states";
import { ledgerRange } from "../../../lib/ledger/range";
import {
  balanceQuery,
  profitQuery,
  trialQuery,
  useStatementExport,
} from "../../../queries/ledger/books";
import type { Statement } from "../../../schemas/ledger/views";

const STATEMENTS: { value: Statement; label: string }[] = [
  { value: "trial", label: "Trial balance" },
  { value: "profit", label: "Profit and loss" },
  { value: "balance", label: "Balance sheet" },
];

/** The trial balance and balance sheet at a day, and profit and loss over a range; D downloads the one shown as CSV. */
export function LedgerStatementsScreen() {
  const search = useSearch({ from: "/_shop/ledger/statements" });
  const navigate = useNavigate();
  const range = ledgerRange(search);
  const statement = search.statement ?? "trial";
  const download = useStatementExport(statement, range.from, range.to);
  const shortcuts = useShortcuts({ D: () => !download.isPending && download.mutate() });
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col">
      <LedgerPage
        active="statements"
        action={
          <Button
            variant="outline"
            aria-keyshortcuts="D"
            aria-busy={download.isPending}
            onClick={() => download.mutate()}
          >
            <DownloadIcon aria-hidden />
            {download.isPending ? "Downloading…" : "Download CSV"}
          </Button>
        }
      >
        <Gate
          need="ledger.read"
          what="the books"
          fallback={<RangeSkeleton label="Loading the statement" />}
        >
          <Tabs value={statement} activationMode="manual" className="gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <LedgerRange
                from={statement === "profit" ? range.from : undefined}
                to={range.to}
                toLabel={statement === "profit" ? "To" : "As of"}
                onChange={(change) =>
                  void navigate({
                    to: "/ledger/statements",
                    search: { ...range, statement, ...change },
                    replace: true,
                  })
                }
              />
              <TabsList variant="line" aria-label="Statement">
                {STATEMENTS.map(({ value, label }) => (
                  <TabsTrigger key={value} value={value} asChild>
                    <Link to="/ledger/statements" search={{ ...range, statement: value }} replace>
                      {label}
                    </Link>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {/* Only the chosen statement's panel exists; the other triggers are links to theirs. */}
            <TabsContent value={statement}>
              <Suspense fallback={<LinesSkeleton label="Loading the statement" />}>
                {statement === "trial" && <Trial asOf={range.to} />}
                {statement === "profit" && <Profit {...range} />}
                {statement === "balance" && <Balance asOf={range.to} />}
              </Suspense>
            </TabsContent>
          </Tabs>
        </Gate>
      </LedgerPage>
    </div>
  );
}

function Trial({ asOf }: { asOf: string }) {
  const { data } = useSuspenseQuery(trialQuery(asOf));
  if (data.rows.length === 0) return <NothingPosted what={`by ${asOf}`} />;
  return <TrialTable data={data} />;
}

function Profit({ from, to }: { from: string; to: string }) {
  const { data } = useSuspenseQuery(profitQuery(from, to));
  if (!data.income.length && !data.expenses.length)
    return <NothingPosted what={`from ${from} to ${to}`} />;
  return <ProfitTable data={data} />;
}

function Balance({ asOf }: { asOf: string }) {
  const { data } = useSuspenseQuery(balanceQuery(asOf));
  if (!data.assets.length && !data.liabilities.length && !data.equity.length)
    return <NothingPosted what={`by ${asOf}`} />;
  return <BalanceTable data={data} />;
}
