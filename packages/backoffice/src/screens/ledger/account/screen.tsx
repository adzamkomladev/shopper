import { Suspense } from "react";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { AccountLines } from "../../../components/ledger/accounts/lines";
import { TYPE_LABELS } from "../../../components/ledger/labels";
import { LedgerRange } from "../../../components/ledger/range";
import { LinesSkeleton, NothingPosted, RangeSkeleton } from "../../../components/ledger/states";
import { Gate } from "../../../components/register/states";
import { focusIfIdle } from "../../../lib/focus";
import { ledgerRange } from "../../../lib/ledger/range";
import { accountLinesQuery } from "../../../queries/ledger/books";

/** One account's lines over a range of shop dates, each linked to what posted it. */
export function LedgerAccountScreen() {
  const { id } = useParams({ from: "/_shop/ledger/accounts/$id" });
  const search = useSearch({ from: "/_shop/ledger/accounts/$id" });
  const navigate = useNavigate();
  const range = ledgerRange(search);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <Link
        to="/ledger"
        className="order-first flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        Accounts
      </Link>
      <Gate
        need="ledger.read"
        what="the books"
        fallback={<RangeSkeleton label="Loading the account" />}
      >
        <LedgerRange
          {...range}
          onChange={(change) =>
            void navigate({
              to: "/ledger/accounts/$id",
              params: { id },
              search: { ...range, ...change },
              replace: true,
            })
          }
        />
        <Suspense fallback={<LinesSkeleton label="Loading the account" />}>
          <Lines id={id} {...range} />
        </Suspense>
      </Gate>
    </div>
  );
}

function Lines({ id, from, to }: { id: string; from: string; to: string }) {
  const { data } = useSuspenseQuery(accountLinesQuery(id, from, to));
  return (
    <>
      <h1
        tabIndex={-1}
        ref={focusIfIdle}
        className="order-first text-2xl font-semibold tracking-tight outline-none"
      >
        {data.account.code} {data.account.name}
        <span className="ml-3 text-base font-normal text-muted-foreground">
          {TYPE_LABELS[data.account.type]}
        </span>
      </h1>
      {data.lines.length === 0 && data.opening === 0 ? (
        <NothingPosted what={`from ${from} to ${to}`} />
      ) : (
        <AccountLines {...data} />
      )}
    </>
  );
}
