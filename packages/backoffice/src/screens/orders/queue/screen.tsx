import { Suspense } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { Input } from "@shopper/ui/components/input/control";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { Gate, OfflineNote } from "../../../components/register/states";
import {
  NoOrders,
  OrderRowsSkeleton,
  OrdersSkeleton,
} from "../../../components/orders/queue/states";
import { OrderTable } from "../../../components/orders/queue/table";
import { StageTabs } from "../../../components/orders/queue/tabs";
import { focusIfIdle } from "../../../lib/focus";
import { orderQueueQuery } from "../../../queries/orders/queue";
import type { OrderSearch } from "../../../schemas/orders";

const SEARCH_ID = "order-search";

/** The store's online orders by stage, soonest slot first; an order opens for picking. */
export function OrderQueueScreen() {
  const search = useSearch({ from: "/_shop/orders" });
  const navigate = useNavigate({ from: "/orders" });
  const online = useOnline();
  const go = (next: Partial<OrderSearch>) =>
    navigate({ search: { ...search, ...next }, replace: true });
  const shortcuts = useShortcuts({ "/": () => document.getElementById(SEARCH_ID)?.focus() });
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
      <h1
        tabIndex={-1}
        ref={focusIfIdle}
        className="text-2xl font-semibold tracking-tight outline-none"
      >
        Online orders
      </h1>
      <Gate need="order.read" what="online orders" fallback={<OrdersSkeleton />}>
        {!online && (
          <OfflineNote>
            You can read the orders loaded earlier; new orders and changes need a connection.
          </OfflineNote>
        )}
        <div className="relative max-w-sm">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={SEARCH_ID}
            type="search"
            aria-label="Search orders"
            aria-keyshortcuts="/"
            placeholder="Order number or customer"
            className="pl-8"
            defaultValue={search.q ?? ""}
            onChange={(event) => go({ q: event.target.value || undefined })}
          />
        </div>
        <Suspense
          fallback={
            <StageTabs search={search}>
              <OrderRowsSkeleton />
            </StageTabs>
          }
        >
          <Stage search={search} onClear={() => go({ q: undefined })} />
        </Suspense>
      </Gate>
    </div>
  );
}

function Stage({ search, onClear }: { search: OrderSearch; onClear: () => void }) {
  const { data } = useSuspenseQuery(orderQueueQuery(search));
  return (
    <StageTabs search={search} counts={data.counts}>
      {data.orders.length === 0 ? (
        <NoOrders stage={search.stage ?? "new"} searching={!!search.q} onClear={onClear} />
      ) : (
        <OrderTable rows={data.orders} now={new Date()} />
      )}
    </StageTabs>
  );
}
