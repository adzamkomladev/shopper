import { Loader2, Server } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import type { PurchaseLookup } from "../../sale/types";

/** What a failed lookup says; null while nothing went wrong. */
export function lookupProblem({ status, receipt, message }: PurchaseLookup) {
  if (status === "missing") return `No sale with receipt ${receipt} in this store`;
  if (status === "offline") return "Connect to find sales from other registers";
  if (status === "failed") return message ?? "The server could not be reached. Try again.";
  return null;
}

/**
 * The row under an empty search: this register has no such receipt, so ask the server for it. Offline it only
 * says what is needed.
 */
export function FindOnServer({
  query,
  lookup,
  online,
  onFind,
}: {
  query: string;
  lookup: PurchaseLookup;
  online: boolean;
  onFind: () => void;
}) {
  const running = lookup.status === "loading";
  const problem = lookupProblem(lookup);
  const offline = !online || lookup.status === "offline";
  return (
    <section
      aria-label="Find on server"
      className="grid min-h-64 flex-1 place-items-center rounded-lg border bg-card px-5 text-center"
    >
      <div className="grid justify-items-center gap-3">
        <div>
          <p className="font-semibold">No receipt {query} on this register</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {offline
              ? "Connect to find sales from other registers"
              : "Sales from other registers are on the server."}
          </p>
        </div>
        <Button
          aria-disabled={running || undefined}
          disabled={offline}
          onClick={onFind}
          size="touch"
          variant="outline"
        >
          {running ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <Server aria-hidden="true" />
          )}
          {running ? "Looking…" : "Find on server"} <Kbd className="max-sm:hidden">Enter</Kbd>
        </Button>
        {problem && !offline && (
          <p className="text-sm text-destructive" role="alert">
            {problem}
          </p>
        )}
      </div>
    </section>
  );
}

/** A failed lookup from a Returns row, above the list. */
export function LookupAlert({ lookup }: { lookup: PurchaseLookup }) {
  const problem = lookupProblem(lookup);
  if (!problem) return null;
  return (
    <Alert className="shrink-0" variant="destructive">
      <AlertTitle>Sale could not be opened</AlertTitle>
      <AlertDescription>{problem}</AlertDescription>
    </Alert>
  );
}
