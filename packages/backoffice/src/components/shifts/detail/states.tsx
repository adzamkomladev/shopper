import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@shopper/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { ApiError } from "../../../api/client";
import { TileSkeleton } from "../../register/tile";
import { routeStates } from "../../route/states";
import { BackToShifts } from "./header";

/** An unknown or malformed id is a missing shift. Every other failure keeps a way back to the list. */
export function ShiftError(props: ErrorComponentProps) {
  const router = useRouter();
  const status = props.error instanceof ApiError ? props.error.status : undefined;
  const Fallback = routeStates.errorComponent;
  if (status === 403) return <Fallback {...props} />;
  const missing = status === 404 || status === 400;
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>
          <h1>{missing ? "Shift not found" : "Something went wrong"}</h1>
        </EmptyTitle>
        <EmptyDescription>
          {missing
            ? "This shift doesn't exist, or it belongs to another shop."
            : props.error instanceof Error
              ? props.error.message
              : "Try again in a moment."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center">
        {!missing && (
          <Button
            variant="outline"
            onClick={() => {
              props.reset();
              void router.invalidate();
            }}
          >
            Try again
          </Button>
        )}
        <Button asChild variant="outline">
          <Link to="/shifts">Back to shifts</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}

// The Z report's sections in the order they sit in the grid, with the card heights of a typical shift
// (3 tenders, a count of two faces, two drops, one cashier), measured in the loaded page.
const SECTIONS = [
  ["w-24", "h-40.5"],
  ["w-48", "h-53.75"],
  ["w-36", "h-48.5"],
  ["w-32", "h-32.75"],
  ["w-44", "h-30.75"],
  ["w-24", "h-22.75"],
  ["w-28", "h-18.5"],
] as const;
// Opened and Closed wrap to two lines in a phone's half-width column.
const FACT_VALUES = ["h-5", "h-5 max-sm:h-10", "h-5 max-sm:h-10", "h-5", "h-5"] as const;

/** The loaded page's layout with its blocks in place: back link and heading, facts, then the report. */
export function ShiftSkeleton() {
  return (
    <div
      className="flex flex-col gap-8 pb-6"
      role="status"
      aria-busy="true"
      aria-label="Loading shift"
    >
      <div className="flex flex-col gap-3">
        <BackToShifts />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-5.5 w-26 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-5">
          {FACT_VALUES.map((value, index) => (
            <div key={index} className="flex flex-col gap-0.5">
              <Skeleton className="h-4 w-12" />
              <Skeleton className={`w-24 ${value}`} />
            </div>
          ))}
        </div>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {["w-44", "w-28"].map((label) => (
            <div key={label} className="flex flex-col gap-0.5">
              <Skeleton className={`h-4 ${label}`} />
              <Skeleton className="h-5 w-64 max-w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-7 w-28" />
        <div className="grid gap-5 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <TileSkeleton key={index} />
          ))}
        </div>
        <div className="grid items-start gap-6 xl:grid-cols-2">
          {SECTIONS.map(([title, card]) => (
            <div key={card} className="flex flex-col gap-3">
              <Skeleton className={`h-6 ${title}`} />
              <Skeleton className={`rounded-lg ${card}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
