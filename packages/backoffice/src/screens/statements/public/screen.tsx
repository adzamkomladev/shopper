import { useParams } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { CircleAlertIcon, DownloadIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { Entries } from "../../../components/statements/public/entries";
import { PublicPage } from "../../../components/statements/public/states";
import { signedGHS, statementDay } from "../../../lib/statements/format";
import { downloadStatementPdf, statementQuery } from "../../../queries/statements/public";

/** What a customer sees when they open the link they were sent: their statement, readable on a phone, with a PDF to keep. */
export function PublicStatementScreen() {
  const { token } = useParams({ from: "/statement/$token" });
  const { data: statement } = useSuspenseQuery(statementQuery(token));
  const { from, to } = statement.period;
  const pdf = useMutation({
    mutationFn: () => downloadStatementPdf(token, `statement-${from}-${to}.pdf`),
  });
  return (
    <PublicPage>
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight wrap-break-word">{statement.shop.name}</h1>
        <p className="text-lg">Statement for {statement.customer.name}</p>
        <p className="text-sm text-muted-foreground">
          <time dateTime={from}>{statementDay(from)}</time> to{" "}
          <time dateTime={to}>{statementDay(to)}</time>
        </p>
      </header>
      <Button className="self-start" disabled={pdf.isPending} onClick={() => pdf.mutate()}>
        <DownloadIcon aria-hidden />
        {pdf.isPending ? "Preparing PDF…" : "Download PDF"}
      </Button>
      {pdf.error && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden />
          <AlertDescription>{pdf.error.message}</AlertDescription>
        </Alert>
      )}
      <dl className="grid grid-cols-2 gap-3">
        <Balance id="opening" label="Opening balance" amount={statement.opening} />
        <Balance id="closing" label="Closing balance" amount={statement.closing} />
      </dl>
      <p className="text-sm text-muted-foreground">
        A balance is what you owe the shop. A balance below zero is credit in your favour.
      </p>
      <Entries entries={statement.entries} />
    </PublicPage>
  );
}

function Balance({ id, label, amount }: { id: string; label: string; amount: number }) {
  return (
    <div data-testid={id} className="flex flex-col gap-1 rounded-lg border bg-card p-4 shadow-sm">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{signedGHS(amount)}</dd>
    </div>
  );
}
