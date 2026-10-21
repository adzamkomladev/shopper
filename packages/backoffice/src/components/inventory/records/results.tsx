import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { KINDS } from "../../../lib/inventory/records";
import { recordsListQuery } from "../../../queries/inventory/records";
import type { RecordsSearch } from "../../../queries/inventory/types";
import { NoRecords } from "./states";
import { RecordsTable } from "./table";

type Props = {
  branchId: string;
  branchName: string;
  kind: RecordsSearch["kind"];
  canWrite: boolean;
};

/** The part of the screen that waits for the records: the table, or what stands in for it. */
export function RecordsResults({ branchId, branchName, kind, canWrite }: Props) {
  const query = recordsListQuery({ branchId, kind });
  const { data, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } =
    useSuspenseInfiniteQuery(query);
  const records = data.pages.flatMap((page) => page.items);
  return (
    <>
      {records.length === 0 ? (
        <NoRecords
          branchId={branchId}
          branchName={branchName}
          label={KINDS.find((entry) => entry.kind === kind)?.label}
          canWrite={canWrite}
        />
      ) : (
        <RecordsTable
          // A new kind starts the table over, including its "end reached" bookkeeping.
          key={query.queryKey.join("|")}
          records={records}
          onEndReached={() =>
            hasNextPage && !isFetchingNextPage && !isFetchNextPageError && void fetchNextPage()
          }
        />
      )}
      {isFetchNextPageError && (
        <Alert variant="destructive" className="flex items-center gap-3">
          <CircleAlertIcon aria-hidden />
          <AlertDescription className="flex-1">Couldn't load more records.</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => void fetchNextPage()}>
            Retry
          </Button>
        </Alert>
      )}
      {isFetchingNextPage && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          Loading more records…
        </p>
      )}
    </>
  );
}
