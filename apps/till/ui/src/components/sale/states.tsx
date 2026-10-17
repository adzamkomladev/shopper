import type { ReactNode } from "react";
import {
  CircleAlert,
  CircleCheck,
  Hourglass,
  Plug,
  ScanLine,
  ServerOff,
  ShieldAlert,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
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
import { isPriced } from "../../sale/rows";
import type { Row } from "../../sale/types";
import type { SaleActions, SaleFailure, SaleSnapshot } from "../../sale/types";

type Tone = "problem" | "warning" | "pending";

const toneClass: Record<Tone, string> = {
  problem: "border-destructive/40 text-destructive",
  warning: "border-warning-border bg-warning text-warning-foreground",
  pending: "bg-card text-card-foreground",
};

/** One strip with a title, one sentence of what to do, and an optional action. */
export function Banner({
  tone,
  icon: Icon,
  title,
  action,
  id,
  children,
}: {
  tone: Tone;
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
  id?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("flex items-center gap-3 rounded-md border px-4 py-2 text-sm", toneClass[tone])}
      id={id}
      role={tone === "problem" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium wrap-anywhere">{title}</p>
        <p className={tone === "problem" ? "text-foreground" : undefined}>{children}</p>
      </div>
      {action}
    </div>
  );
}

const failureCopy: Record<SaleFailure, { title: string; body: string; icon: LucideIcon }> = {
  session: {
    title: "Your session has expired",
    body: "Sign in again on the register host. The basket is saved and waiting.",
    icon: ShieldAlert,
  },
  permission: {
    title: "You cannot sell on this register",
    body: "Ask a manager to give your account the sell permission.",
    icon: ShieldAlert,
  },
  storage: {
    title: "The register could not read the basket",
    body: "Nothing was lost. Retry, and restart the register if it keeps happening.",
    icon: CircleAlert,
  },
};

/** Why edits are disabled, or the notices that do not block them. Renders nothing when all is well. */
export function SaleBanners({
  snapshot,
  rows,
  actions,
  describedBy,
}: {
  snapshot: SaleSnapshot;
  rows: Row[];
  actions: SaleActions;
  describedBy: string;
}) {
  const { host, failure, feedback, sync } = snapshot;
  const unpriced = rows.filter((row) => !isPriced(row)).length;
  const retry = (label: string) => (
    <Button aria-keyshortcuts="F9" onClick={actions.reconnect} size="touch" variant="outline">
      {label} <Kbd className="pointer-coarse:inline-flex">F9</Kbd>
    </Button>
  );
  return (
    <div className="flex flex-col gap-2 empty:hidden">
      {host === "disconnected" && (
        <Banner
          action={retry("Reconnect")}
          icon={Plug}
          id={describedBy}
          title="Register host disconnected"
          tone="problem"
        >
          Edits are paused so no change is lost. The basket is saved on this register; reconnect to
          continue.
        </Banner>
      )}
      {host === "connecting" && (
        <Banner
          icon={Hourglass}
          id={describedBy}
          title="Connecting to the register host"
          tone="pending"
        >
          Edits resume as soon as the register answers.
        </Banner>
      )}
      {host === "connected" && failure && (
        <Banner
          action={failure === "storage" ? retry("Retry") : undefined}
          icon={failureCopy[failure].icon}
          id={describedBy}
          title={failureCopy[failure].title}
          tone="problem"
        >
          {failureCopy[failure].body}
        </Banner>
      )}
      {sync.offline && (
        <Banner icon={ServerOff} title="Server offline" tone="warning">
          Sales are saved on this register and upload when the connection returns.
        </Banner>
      )}
      {unpriced > 0 && (
        <Banner
          icon={TriangleAlert}
          title={`${unpriced} line${unpriced === 1 ? "" : "s"} cannot be priced`}
          tone="warning"
        >
          Totals leave them out. Remove them, or ask a manager to fix the catalogue.
        </Banner>
      )}
      {feedback && (
        <Banner
          icon={ScanLine}
          title={
            feedback.kind === "unknown"
              ? `Barcode ${feedback.code} was not found`
              : "Nothing was added"
          }
          tone="warning"
        >
          {feedback.kind === "unknown"
            ? "Check the label, or press F2 and search by name or SKU."
            : feedback.message}
        </Banner>
      )}
    </div>
  );
}

export function EmptyBasket() {
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ScanLine aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Basket is empty</EmptyTitle>
        <EmptyDescription>
          Scan a barcode, or press F2 and search by name or SKU. Items you add are saved on this
          register.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function CompletedBasket({
  startsOnScan,
  refused,
}: {
  startsOnScan: boolean;
  /** A scan or keyed code was turned away because it would not start a sale. */
  refused: boolean;
}) {
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleCheck aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Sale complete</EmptyTitle>
        <EmptyDescription>
          {startsOnScan
            ? "The receipt is ready. Scan the next item, or press Enter, to start a new sale."
            : "The receipt is ready. Press Enter or New sale to start another basket."}
        </EmptyDescription>
      </EmptyHeader>
      {refused && (
        <p className="text-sm font-medium text-destructive" role="alert">
          Sale complete. Press Enter or New sale, then scan again.
        </p>
      )}
    </Empty>
  );
}

export function UnavailableBasket() {
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Plug aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Basket unavailable</EmptyTitle>
        <EmptyDescription>It shows again as soon as the problem above is fixed.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** Same row height and column widths as the lines, so nothing jumps when they arrive. */
export function LinesSkeleton() {
  return (
    <div aria-label="Loading basket" className="flex flex-1 flex-col" role="status">
      {Array.from({ length: 5 }, (_, index) => (
        <div className="flex h-16 items-center gap-3 border-b px-4" key={index}>
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-11 w-36" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="size-11" />
        </div>
      ))}
    </div>
  );
}
