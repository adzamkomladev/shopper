import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@shopper/ui/components/button";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { formatGHS } from "@shopper/money";
import { ArrowLeft, Download } from "lucide-react";
import { ShopApiError, signInWhenRefused } from "../../queries/api";
import { receiptQuery } from "../../queries/account";
import { ReceiptPaper } from "../../components/receipt/paper";
import { ReceiptSkeleton } from "../../components/receipt/skeleton";
import { Missing } from "../../components/shop/missing";
import { pageRef } from "../../components/shop/focus";
import { shopDate } from "../../components/shop/phone";

export const Route = createFileRoute("/$shop/receipts/$saleId")({
  ssr: false,
  loader: ({ context, params }) =>
    context.queryClient
      .ensureQueryData(receiptQuery(params.shop, params.saleId))
      .catch(signInWhenRefused(params.shop)),
  pendingComponent: ReceiptSkeleton,
  errorComponent: ReceiptError,
  component: Receipt,
});

/** One receipt: the total up top, the till's receipt below, and the till's own PDF when it has uploaded one. */
function Receipt() {
  const { shop, saleId } = Route.useParams();
  const navigate = useNavigate();
  const sale = useSuspenseQuery(receiptQuery(shop, saleId)).data;
  const pdf = `/api/shop/account/receipts/${encodeURIComponent(sale.id)}/pdf`;
  const shortcuts = useShortcuts({
    Escape: () => void navigate({ to: "/$shop/account", params: { shop } }),
    ...(sale.pdf ? { D: () => window.location.assign(pdf) } : {}),
  });
  return (
    <main
      ref={pageRef(shortcuts)}
      tabIndex={-1}
      className="mx-auto outline-none max-w-xl space-y-6 px-5 pt-6 pb-16"
    >
      <Button
        asChild
        variant="ghost"
        className="-ml-2 h-10 rounded-full font-semibold"
        aria-keyshortcuts="Escape"
      >
        <Link to="/$shop/account" params={{ shop }}>
          <ArrowLeft aria-hidden /> Your receipts
        </Link>
      </Button>
      <section
        className="space-y-4 rounded-panel bg-card p-6 shadow-sm"
        style={{ viewTransitionName: `receipt-${sale.id}` }}
      >
        <div className="space-y-1">
          <p className="font-semibold text-muted-foreground">
            {sale.branchName} · {shopDate(sale.occurredAt, "full")}
          </p>
          <h1 className="text-5xl font-black tracking-tighter tabular-nums">
            {formatGHS(sale.total)}
          </h1>
          {sale.receiptNumber ? (
            <p className="text-sm text-muted-foreground">Receipt {sale.receiptNumber}</p>
          ) : null}
        </div>
        {sale.pdf ? (
          <Button
            asChild
            size="touch"
            className="h-12 w-full rounded-2xl font-bold"
            aria-keyshortcuts="D"
          >
            <a href={pdf} download>
              <Download aria-hidden /> Download PDF
            </a>
          </Button>
        ) : (
          <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            The PDF appears here once the till sends it. The receipt below is the same one.
          </p>
        )}
      </section>
      {sale.receipt ? (
        <ReceiptPaper receipt={sale.receipt} />
      ) : (
        <p className="text-center text-muted-foreground">This sale has no printed receipt.</p>
      )}
    </main>
  );
}

function ReceiptError({ error, reset }: { error: unknown; reset: () => void }) {
  const { shop } = Route.useParams();
  const navigate = useNavigate();
  const missing = error instanceof ShopApiError && error.status === 404;
  return (
    <Missing
      title={missing ? "We could not find that receipt" : "We could not load that receipt"}
      description={
        missing
          ? "It may belong to another number. Your receipts are on your account."
          : "Check your connection, then try again."
      }
      action={
        missing
          ? {
              label: "Your receipts",
              onClick: () => void navigate({ to: "/$shop/account", params: { shop } }),
            }
          : { label: "Try again", onClick: reset }
      }
    />
  );
}
