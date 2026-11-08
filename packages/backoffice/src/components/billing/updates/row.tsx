import { useState } from "react";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@shopper/ui/components/alert/dialog";
import { formatDay } from "@shopper/utils";
import type { UpdatesResponse } from "@shopper/core/release";
import { useUpdateInstall } from "../../../queries/updates";
import { ScheduleDialog } from "./schedule";

type Bundle = UpdatesResponse["bundles"][number];

/**
 * One bundle: its version, the day it was built, why it cannot be installed, or Install now / After closing. A tax
 * rule pack is applied at once (no restart, never scheduled), whatever the licence's updates date.
 */
export function BundleRow({ bundle, busy }: { bundle: Bundle; busy: boolean }) {
  const install = useUpdateInstall();
  const [confirming, setConfirming] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const refused = bundle.verdict.ok ? undefined : bundle.verdict.message;
  const installable = bundle.kind === "update" && !refused;
  const pack = bundle.kind === "taxpack" && !refused;
  return (
    <li className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{bundle.version}</span>
          {bundle.kind === "taxpack" && <Badge variant="secondary">Tax rules</Badge>}
          <span className="text-muted-foreground">Built {formatDay(bundle.builtAt)}</span>
        </div>
        <span className="truncate font-mono text-xs text-muted-foreground">{bundle.file}</span>
        {refused && <p className="text-destructive">{refused}</p>}
      </div>
      {installable && (
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            disabled={busy || install.isPending}
            onClick={() => setScheduling(true)}
          >
            After closing
          </Button>
          <Button disabled={busy || install.isPending} onClick={() => setConfirming(true)}>
            Install now
          </Button>
        </div>
      )}
      {pack && (
        <Button
          className="shrink-0"
          disabled={busy || install.isPending}
          onClick={() => setConfirming(true)}
        >
          Apply tax rules
        </Button>
      )}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pack ? `Apply tax rules ${bundle.version}?` : `Install ${bundle.version} now?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pack
                ? "The pack's rates are scheduled for the days GRA set. A rule you scheduled for one of those days with other rates is replaced; one that matches is left alone. The box does not restart; sales already made keep their tax."
                : "The box makes a verified backup, then restarts. The back office is unavailable for about a minute; tills keep selling. If the new version does not start, the box switches back."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => install.mutate({ file: bundle.file, version: bundle.version })}
            >
              {pack ? "Apply" : "Install"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ScheduleDialog
        open={scheduling}
        onOpenChange={setScheduling}
        version={bundle.version}
        pending={install.isPending}
        onSchedule={(at) =>
          install.mutate({ file: bundle.file, at }, { onSuccess: () => setScheduling(false) })
        }
      />
    </li>
  );
}
