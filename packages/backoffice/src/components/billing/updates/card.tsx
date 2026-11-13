import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shopper/ui/components/card";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { formatDay } from "@shopper/utils";
import { updatesQuery, useUpdateCancel } from "../../../queries/updates";
import { BundleRow } from "./row";

const LAST = {
  applied: { title: "Update installed", variant: "default" as const },
  rolled_back: { title: "Update rolled back", variant: "destructive" as const },
  failed: { title: "Update did not start", variant: "destructive" as const },
};

/** The box's update bundles: what is running, what is waiting in the updates folder, and what the last attempt did. */
export function UpdatesCard() {
  const updates = useQuery(updatesQuery());
  const cancel = useUpdateCancel();
  // The cloud has no updates (404) and a box without Shopper's release key offers none: nothing to show.
  if (updates.isError) return null;
  const data = updates.data;
  return (
    <Card aria-busy={!data}>
      <CardHeader>
        <CardDescription>Updates</CardDescription>
        <CardTitle className="flex flex-wrap items-center gap-3">
          {data ? `Running ${data.running.version}` : <Skeleton className="h-7 w-40" />}
          {data && <Badge variant="outline">Slot {data.running.slot.toUpperCase()}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {!data ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            {data.last && (
              <Alert variant={LAST[data.last.status].variant}>
                <AlertTitle>
                  {LAST[data.last.status].title} · {data.last.version}
                </AlertTitle>
                <AlertDescription>{data.last.message ?? formatDay(data.last.at)}</AlertDescription>
              </Alert>
            )}
            {data.scheduled && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-3">
                <p>
                  <span className="font-medium">{data.scheduled.file}</span> installs{" "}
                  {new Date(data.scheduled.at).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  .
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate()}
                >
                  Cancel
                </Button>
              </div>
            )}
            {data.bundles.length ? (
              <ul className="flex flex-col divide-y rounded-md border">
                {data.bundles.map((bundle) => (
                  <BundleRow key={bundle.file} bundle={bundle} busy={!!data.scheduled} />
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">
                No update bundles yet. Plug the USB stick with the update from Shopper into the box;
                its bundles appear here a few seconds later.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
