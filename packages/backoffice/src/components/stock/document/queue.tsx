import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { Badge } from "@shopper/ui/components/badge";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { LoadError } from "../../register/states";
import { stockQueueQuery } from "../../../queries/stock/queue";
import type { StockQueueRow } from "../../../schemas/stock/queue";

const status = {
  queued: { label: "Queued", variant: "secondary" },
  sent: { label: "Sent", variant: "outline" },
  rejected: { label: "Rejected", variant: "destructive" },
} as const;

const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/** What was queued on this register, newest first, and what became of it. A rejection says why. */
export function StockQueue() {
  const queue = useQuery(stockQueueQuery());
  return (
    <section aria-labelledby="stock-queue-title" className="flex min-w-0 flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight" id="stock-queue-title">
        Queue
      </h2>
      {queue.isError ? (
        <LoadError error={queue.error} onRetry={() => void queue.refetch()} what="the queue" />
      ) : queue.isPending ? (
        <div
          aria-busy="true"
          aria-label="Loading the queue"
          className="flex flex-col gap-2"
          role="status"
        >
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : queue.data.length === 0 ? (
        <p className="flex items-center gap-3 rounded-2xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
          <Inbox aria-hidden className="size-4 shrink-0" />
          Nothing queued. Counts and deliveries you enter show up here until they reach the server.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {queue.data.map((row) => (
            <QueueRow key={row.id} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}

function QueueRow({ row }: { row: StockQueueRow }) {
  const { label, variant } = status[row.status];
  const count = row.payload.lines.length;
  return (
    <li className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate font-medium">
          {row.kind === "count" ? "Stock count" : "Delivery received"}
          <span className="font-normal text-muted-foreground">
            {" "}
            · {count === 1 ? "1 product" : `${count} products`}
          </span>
        </p>
        <Badge variant={variant}>{label}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{dateTime.format(new Date(row.createdAt))}</p>
      {row.status === "rejected" && row.blockedReason && (
        <p className="text-sm text-destructive">{row.blockedReason}</p>
      )}
    </li>
  );
}
