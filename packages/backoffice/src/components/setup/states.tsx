import { Skeleton } from "@shopper/ui/components/skeleton";
import { usePermissions } from "../../queries/session/permissions";
import { FieldSkeleton } from "../settings/states";

// The wizard has seven steps; the panel's form is a few fields, whichever step opens.
const RAIL_STEPS = 7;

/** The wizard's shape while its progress loads: the heading, the step rail and one step's panel. */
export function SetupSkeleton() {
  // Finish later is for members who may change the shop; the other members see no button.
  const canWrite = usePermissions()?.includes("store.write");
  return (
    <div
      className="flex flex-col gap-6 pb-6"
      role="status"
      aria-busy="true"
      aria-label="Loading setup"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Get your shop ready</h1>
          <Skeleton className="h-5 w-72" />
        </div>
        {canWrite && <Skeleton className="h-8 w-24.75" />}
      </header>
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="-mx-1 flex gap-2 overflow-hidden px-1 lg:mx-0 lg:flex-col lg:px-0">
          {Array.from({ length: RAIL_STEPS }, (_, index) => (
            <Skeleton key={index} className="h-10 w-28 shrink-0 lg:w-full" />
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-6 self-start rounded-lg border bg-card p-4 sm:p-6">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-5 w-96 max-w-full" />
          </div>
          <div className="flex flex-col gap-7">
            {(["text", "text", "text", "choice"] as const).map((field, index) => (
              <FieldSkeleton key={index} field={field} />
            ))}
          </div>
          <div className="flex justify-between gap-2 border-t pt-4">
            <Skeleton className="h-8 w-18" />
            <Skeleton className="h-8 w-34" />
          </div>
        </div>
      </div>
    </div>
  );
}
