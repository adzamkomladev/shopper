import { CircleAlert, Lock, PlugZap, Printer } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { Kbd } from "@shopper/ui/components/kbd";
import { Skeleton } from "@shopper/ui/components/skeleton";

/** The X report's layout in grey: three tiles, then the tables. */
export function ReportSkeleton() {
  return (
    <div aria-label="Loading the X report" className="grid gap-6" role="status">
      <Skeleton className="h-14 w-72" />
      <div className="grid gap-5 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton className="h-35 rounded-2xl" key={index} />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </div>
  );
}

export function ReportFailed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="flex flex-wrap items-center gap-4 rounded-lg border border-destructive/40 bg-card p-4"
      role="alert"
    >
      <CircleAlert aria-hidden="true" className="size-5 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">The X report could not be read</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <Button onClick={onRetry} size="touch" type="button" variant="outline">
        Try again
      </Button>
    </div>
  );
}

/** What a cashier without report.read sees in the X report's place: who to ask, and no figures. */
export function ReportRestricted() {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
      <Lock aria-hidden="true" className="size-4 shrink-0" />
      An X report is for managers. Ask a manager if you need one.
    </div>
  );
}

export function HostLost({ onReconnect }: { onReconnect: () => void }) {
  return (
    <div
      className="flex flex-wrap items-center gap-4 rounded-lg border border-destructive/40 bg-card p-4"
      role="alert"
    >
      <PlugZap aria-hidden="true" className="size-5 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Register host disconnected</p>
        <p className="text-sm text-muted-foreground">
          The shift lives on the register host. Reconnect to read it or change it.
        </p>
      </div>
      <Button
        aria-keyshortcuts="F9"
        onClick={onReconnect}
        size="touch"
        type="button"
        variant="outline"
      >
        Reconnect <Kbd className="max-sm:hidden">F9</Kbd>
      </Button>
    </div>
  );
}

/** No shift yet: say so and offer the one thing to do. */
export function NoShift({ canOpen, onOpen }: { canOpen: boolean; onOpen: () => void }) {
  return (
    <Empty className="rounded-lg border border-solid bg-card shadow-sm lg:col-span-2">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Lock aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>No shift open</EmptyTitle>
        <EmptyDescription>
          {canOpen ? "Open a shift to start selling." : "Ask a manager to open a shift."}
        </EmptyDescription>
      </EmptyHeader>
      {canOpen && (
        <Button aria-keyshortcuts="Alt+O" autoFocus onClick={onOpen} size="touch" type="button">
          Open shift <Kbd className="max-sm:hidden">Alt+O</Kbd>
        </Button>
      )}
    </Empty>
  );
}

/** Reports can be read without a printer, but not printed: say so before the cashier tries. */
export function PrinterNote({ state }: { state: "unconfigured" | "ready" | "offline" }) {
  if (state === "ready") return null;
  return (
    <p
      className="flex items-center gap-2 text-sm text-muted-foreground lg:col-span-3"
      role="status"
    >
      <Printer aria-hidden="true" className="size-4 shrink-0" />
      {state === "offline"
        ? "The printer is offline. Reports can be read here, and printed when it is back."
        : "No printer is set up. Reports can be read here but not printed."}
    </p>
  );
}
