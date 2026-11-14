import { useQuery } from "@tanstack/react-query";
import { CloudIcon } from "lucide-react";
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
import { MOVE_ID, MoveCard } from "../../../components/migration/move/card";
import { Gate, LoadError } from "../../../components/register/states";
import { PageSkeleton } from "../../../components/route/states";
import { focusIfIdle } from "../../../lib/focus";
import { moveQuery } from "../../../queries/migration/move";

/** A box hands its shop to the cloud: the owner starts it here and watches every till follow. */
export function MoveScreen() {
  const shortcuts = useShortcuts({ M: () => document.getElementById(MOVE_ID)?.click() });
  return (
    <div ref={shortcuts} className="flex max-w-3xl flex-col gap-6">
      <h1
        tabIndex={-1}
        ref={focusIfIdle}
        className="text-2xl font-semibold tracking-tight outline-none"
      >
        Move to cloud
      </h1>
      <Gate
        need="migration.run"
        what="the move to the cloud"
        verb="start"
        fallback={<PageSkeleton />}
      >
        <Move />
      </Gate>
    </div>
  );
}

function Move() {
  const query = useQuery(moveQuery());
  if (query.error instanceof ApiError && query.error.status === 404)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CloudIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>This shop is already in the cloud</EmptyTitle>
          <EmptyDescription>A shop moves to the cloud from its box's back office.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  if (query.error)
    return <LoadError error={query.error} what="the move" onRetry={() => void query.refetch()} />;
  if (!query.data) return <Skeleton className="h-64 w-full" />;
  return <MoveCard data={query.data} />;
}
