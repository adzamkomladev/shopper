import { Link } from "@tanstack/react-router";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { formatGHS } from "@shopper/money";
import { ChevronRight, ReceiptText } from "lucide-react";
import type { ShopReceiptItem } from "../../schemas/shop";
import { maskPhone, shopDate } from "../shop/phone";

/** Their till receipts, newest first; each card lifts on hover and opens into the receipt. */
export function Receipts({
  shop,
  items,
  phone,
}: {
  shop: string;
  items: ShopReceiptItem[];
  phone: string;
}) {
  return (
    <section aria-labelledby="receipts-title" className="space-y-3 pt-8">
      <div className="flex items-baseline justify-between">
        <h2 id="receipts-title" className="text-xl font-extrabold tracking-tight">
          Your receipts
        </h2>
        {items.length ? (
          <span className="text-sm font-semibold text-muted-foreground">{items.length}</span>
        ) : null}
      </div>
      {items.length === 0 ? (
        <Empty className="rounded-panel border-2 border-dashed bg-card/60">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ReceiptText aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No receipts yet</EmptyTitle>
            <EmptyDescription>
              Give the cashier your number, {maskPhone(phone)}, when you pay. Your receipts show up
              here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="rise-stagger"
              style={{ "--rise-index": Math.min(index, 10) } as React.CSSProperties}
            >
              <ReceiptCard shop={shop} item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReceiptCard({ shop, item }: { shop: string; item: ShopReceiptItem }) {
  return (
    <Link
      to="/$shop/receipts/$saleId"
      params={{ shop, saleId: item.id }}
      className="group flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm transition duration-150 outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-4 focus-visible:ring-ring/40 active:scale-99 sm:gap-4"
      style={{ viewTransitionName: `receipt-${item.id}` }}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-shop-glow text-primary sm:size-12">
        <ReceiptText aria-hidden className="size-5 sm:size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{shopDate(item.occurredAt)}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {item.branchName}
          {item.receiptNumber ? ` · ${item.receiptNumber}` : ""}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-lg font-extrabold tabular-nums">{formatGHS(item.total)}</span>
        {item.status !== "completed" ? (
          <span className="block text-xs font-semibold text-muted-foreground capitalize">
            {item.status}
          </span>
        ) : null}
      </span>
      <ChevronRight
        aria-hidden
        className="hidden size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block"
      />
    </Link>
  );
}
