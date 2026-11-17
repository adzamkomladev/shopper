import { useQuery } from "@tanstack/react-query";
import { ServerIcon } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { ApiError } from "../../../api/client";
import { OnPremCard, START_ID } from "../../../components/migration/onprem/card";
import { Gate, LoadError } from "../../../components/register/states";
import { PageSkeleton } from "../../../components/route/states";
import { focusIfIdle } from "../../../lib/focus";
import { onPremQuery } from "../../../queries/migration/onprem";

/** A cloud shop moves onto its own box: the owner starts it here and follows it to the last till. */
export function OnPremScreen() {
  const shortcuts = useShortcuts({ M: () => document.getElementById(START_ID)?.click() });
  return (
    <div ref={shortcuts} className="flex max-w-3xl flex-col gap-6">
      <h1
        tabIndex={-1}
        ref={focusIfIdle}
        className="text-2xl font-semibold tracking-tight outline-none"
      >
        Move on-prem
      </h1>
      <Gate need="migration.run" what="the move to a box" verb="start" fallback={<PageSkeleton />}>
        <OnPrem />
      </Gate>
    </div>
  );
}

function OnPrem() {
  const query = useQuery(onPremQuery());
  if (query.error instanceof ApiError && query.error.status === 404)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ServerIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>This shop already runs on its own box</EmptyTitle>
          <EmptyDescription>A shop moves onto a box from the cloud's back office.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  if (query.error)
    return <LoadError error={query.error} what="the move" onRetry={() => void query.refetch()} />;
  if (!query.data) return <Skeleton className="h-64 w-full" />;
  return <OnPremCard data={query.data} />;
}
