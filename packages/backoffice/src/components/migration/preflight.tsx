import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  FlaskConicalIcon,
  LoaderCircleIcon,
  TimerIcon,
} from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { formatDay } from "@shopper/utils";
import { dryRunQuery, useDryRunStart } from "../../queries/migration/dryrun";
import type { PreflightChecks } from "../../schemas/migration";

export const DRY_RUN_ID = "migration-dryrun";

const time = (iso: string) =>
  `${formatDay(iso, false)}, ${new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Accra",
  })}`;

/**
 * The move wizard's first step, the same in both directions: is the shop closed, does a dry run seal and verify the
 * archive the move would carry, and how long the shop will stay frozen. Every check advises; the owner decides.
 */
export function Preflight({ checks }: { checks: PreflightChecks }) {
  const start = useDryRunStart();
  const [started, setStarted] = useState<string>();
  const id = started ?? checks.dryRun.exportJobId;
  const result = useQuery({ ...dryRunQuery(id ?? ""), enabled: !!id });
  const run = result.data;
  const running = start.isPending || run?.status === "running";
  const verified = run?.status === "ready" && run.verified && (!!started || checks.dryRun.ok);
  const minutes = run?.status === "ready" ? run.minutes : checks.dryRun.minutes;
  return (
    <section aria-labelledby="preflight-title" className="flex flex-col gap-2">
      <h2 id="preflight-title" className="font-medium">
        Before you start
      </h2>
      <ul aria-label="Pre-flight checks" className="flex flex-col divide-y rounded-md border">
        <Check
          ok={checks.quiet.ok}
          title={checks.quiet.ok ? "The shop looks closed" : "The shop looks open"}
        >
          {checks.quiet.lastSaleAt
            ? `Last sale ${time(checks.quiet.lastSaleAt)}.`
            : "No sales yet."}{" "}
          {!checks.quiet.ok &&
            "Wait until the tills stop: anything sold during the move waits on the till."}
        </Check>
        <Check
          ok={verified}
          pending={running}
          title={
            running
              ? "Dry run: sealing the archive"
              : verified
                ? "Dry run passed"
                : run?.status === "ready" && !run.verified
                  ? "Dry run failed"
                  : "Run a dry run"
          }
          action={
            <Button
              id={DRY_RUN_ID}
              variant="outline"
              size="sm"
              aria-keyshortcuts="D"
              disabled={running}
              onClick={() =>
                start.mutate(undefined, { onSuccess: (job) => setStarted(job.exportJobId) })
              }
            >
              <FlaskConicalIcon aria-hidden />
              {run ? "Run again" : "Dry run"}
            </Button>
          }
        >
          {running && "Nothing is frozen; the shop keeps trading while it seals."}
          {!running && run?.status === "ready" && run.verified && (
            <>
              {run.tables} tables and {run.rows.toLocaleString("en-GB")} records sealed and read
              back intact
              {checks.dryRun.sealedAt && !started && ` (${time(checks.dryRun.sealedAt)})`}.
              {!verified && " Older than a day: run it again tonight."}
            </>
          )}
          {!running && run?.status === "ready" && !run.verified && `${run.message} Run it again.`}
          {!running && run && run.status !== "ready" && "The archive could not be sealed."}
          {!running &&
            !run &&
            "Seals the archive the move would carry and reads it back, without freezing anything."}
          {start.error && <span role="alert"> {start.error.message}</span>}
        </Check>
        <Check ok icon={<TimerIcon aria-hidden className="size-4" />} title="Cutover window">
          {minutes
            ? `About ${minutes} minutes from Start until the new side has checked every record.`
            : "A dry run measures how long the shop stays frozen."}
        </Check>
      </ul>
    </section>
  );
}

function Check(props: {
  ok: boolean;
  pending?: boolean;
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2.5">
      <span className="flex size-5 shrink-0 items-center justify-center">
        {props.icon ??
          (props.pending ? (
            <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
          ) : props.ok ? (
            <CircleCheckIcon aria-hidden className="size-4 text-primary" />
          ) : (
            <CircleAlertIcon aria-hidden className="size-4 text-amber-600 dark:text-amber-400" />
          ))}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{props.title}</span>
        <span role={props.pending ? "status" : undefined} className="text-muted-foreground">
          {props.children}
        </span>
      </span>
      {props.action}
    </li>
  );
}
