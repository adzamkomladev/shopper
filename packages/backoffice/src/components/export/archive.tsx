import { ArchiveIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shopper/ui/components/card";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { useArchiveStart } from "../../queries/export";
import type { archiveList } from "../../schemas/export";
import type * as v from "valibot";
import { ArchiveRowItem } from "./row";

export const ARCHIVE_ID = "export-archive";

/** The whole business as one signed file: what it holds, the button, and the copies made so far. */
export function ArchiveCard({
  data,
  failed,
}: {
  data?: v.InferOutput<typeof archiveList>;
  failed: boolean;
}) {
  const start = useArchiveStart();
  const busy = start.isPending || !!data?.archives.some((archive) => archive.status === "running");
  return (
    <Card aria-busy={!data && !failed}>
      <CardHeader>
        <CardTitle className="text-base">Full copy of your business</CardTitle>
        <CardDescription>
          Every product, price, customer, sale, payment, stock movement, tax record and audit entry,
          with your product images and fiscal documents, in one file you can keep, check and move.
          Passwords, PINs and sign-in sessions are never included.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div>
          <Button
            id={ARCHIVE_ID}
            aria-keyshortcuts="A"
            disabled={busy}
            aria-busy={busy}
            onClick={() => start.mutate()}
          >
            <ArchiveIcon aria-hidden />
            {busy ? "Preparing…" : "Create archive"}
          </Button>
        </div>
        {failed && (
          <Alert variant="destructive">
            <AlertTitle>Your archives could not be loaded</AlertTitle>
            <AlertDescription>Check your connection and refresh the page.</AlertDescription>
          </Alert>
        )}
        {!data && !failed && <Skeleton className="h-16 w-full" />}
        {data && !data.archives.length && (
          <p className="text-muted-foreground">
            No archives yet. Create one to keep a copy of everything, or to move to another Shopper.
          </p>
        )}
        {data && data.archives.length > 0 && (
          <ul aria-label="Archives" className="flex flex-col divide-y rounded-md border">
            {data.archives.map((archive) => (
              <ArchiveRowItem key={archive.id} archive={archive} />
            ))}
          </ul>
        )}
        {data?.fingerprint && (
          <p className="text-muted-foreground">
            Signed with key <span className="font-mono">{data.fingerprint}</span>. Every archive
            names its key inside, so you can check a file came from here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
