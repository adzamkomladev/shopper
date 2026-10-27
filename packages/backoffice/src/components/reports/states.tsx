import { ChartNoAxesColumnIcon } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { Skeleton } from "@shopper/ui/components/skeleton";

/** The heading and tabs are drawn by the screen; this stands in for the toolbar and figures until they arrive. */
export function ReportSkeleton({
  label,
  tiles = false,
  toolbar = true,
}: {
  label: string;
  tiles?: boolean;
  /** False below a toolbar that is already drawn. */
  toolbar?: boolean;
}) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-6">
      {toolbar && <Skeleton className="h-15 w-full max-w-2xl" />}
      {tiles && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      )}
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

/** Nothing to report for the period: say so and what to try. */
export function NothingToReport({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ChartNoAxesColumnIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
