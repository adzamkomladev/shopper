import { Link } from "@tanstack/react-router";
import { CircleCheckIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Card, CardContent, CardHeader } from "@shopper/ui/components/card";
import { focusOnMount } from "../../lib/focus";
import type { ImportResult } from "./queries";

type Props = { result: ImportResult; onImportAnother: () => void };

export function ImportDone({ result, onImportAnother }: Props) {
  const counts = [
    ["Added", result.created],
    ["Updated", result.updated],
    ["Unchanged", result.unchanged],
    ["Prices added", result.pricesAdded],
  ] as const;
  return (
    <Card
      ref={focusOnMount}
      tabIndex={-1}
      role="region"
      aria-labelledby="import-done-title"
      className="outline-none"
    >
      <CardHeader>
        <h2 id="import-done-title" className="flex items-center gap-2 leading-none font-semibold">
          <CircleCheckIcon aria-hidden className="size-5 text-primary" />
          Import finished
        </h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {counts.map(([label, count]) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{count}</dd>
            </div>
          ))}
        </dl>
        {result.rowsFailed > 0 && (
          <p className="text-sm text-muted-foreground">
            {result.rowsFailed === 1 ? "1 row" : `${result.rowsFailed} rows`} with errors{" "}
            {result.rowsFailed === 1 ? "was" : "were"} skipped.
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onImportAnother}>
            Import another file
          </Button>
          <Button asChild>
            <Link to="/products">View products</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
