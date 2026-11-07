import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CreditCard, ExternalLink, Loader2, Smartphone } from "lucide-react";
import { formatGHS } from "@shopper/money";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { RadioGroup, RadioGroupItem } from "@shopper/ui/components/radio-group";
import { shopFetch, ShopApiError } from "../../queries/api";
import { placedOrder, type PlacedOrder } from "../../schemas/checkout";
import { DetailField } from "../checkout/details";
import { phoneOf } from "../shop/phone";

type Method = "card" | "momo";
const networks = [
  ["mtn", "MTN"],
  ["telecel", "Telecel"],
  ["airteltigo", "AirtelTigo"],
] as const;

/**
 * How the shopper pays an order that is still open: a card (Paystack's page), or a mobile money prompt on their
 * phone. A failed attempt says why and offers another go while the items are held; an open attempt is followed until
 * the webhook settles it.
 */
export function PayPanel({
  shop,
  order,
  orderKey,
}: {
  shop: string;
  order: PlacedOrder;
  orderKey: string;
}) {
  const queryClient = useQueryClient();
  const attempt = order.payment;
  const [method, setMethod] = useState<Method>("momo");
  const [network, setNetwork] = useState<(typeof networks)[number][0]>("mtn");
  const [phone, setPhone] = useState("");
  const [tried, setTried] = useState(false);
  const phoneError = /^0\d{9}$/.test(phoneOf(phone))
    ? undefined
    : "Enter a Ghana number like 024 123 4567";
  const pay = useMutation({
    mutationFn: () =>
      shopFetch(`/${shop}/orders/${order.id}/pay`, placedOrder, {
        body: {
          key: orderKey,
          method,
          ...(method === "momo" ? { network, phone: phoneOf(phone) } : {}),
        },
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData([shop, "orders", order.id], updated);
      // A card is paid on Paystack's page; it sends the shopper back here when they are done.
      if (updated.payment?.method === "card" && updated.payment.checkoutUrl)
        window.location.assign(updated.payment.checkoutUrl);
    },
  });
  const refusal = pay.error instanceof ShopApiError ? pay.error : null;
  const open = attempt?.status === "pending";

  return (
    <section aria-labelledby="pay-heading" className="space-y-4 rounded-panel border bg-card p-5">
      <h2 id="pay-heading" className="text-lg font-bold">
        Pay {formatGHS(order.totals.gross)}
      </h2>
      {open && attempt.method === "card" && attempt.checkoutUrl ? (
        <div className="space-y-3">
          <p>Finish paying on Paystack's secure page. We keep your items while you do.</p>
          <Button asChild size="touch" className="h-12 w-full rounded-2xl font-bold">
            <a href={attempt.checkoutUrl}>
              <ExternalLink aria-hidden /> Open Paystack
            </a>
          </Button>
          <p role="status" className="text-sm text-muted-foreground">
            Once you have paid, this page updates by itself.
          </p>
        </div>
      ) : open ? (
        <div role="status" className="flex items-start gap-3">
          <Loader2 aria-hidden className="mt-0.5 size-5 shrink-0 animate-spin text-primary" />
          <p>
            <span className="block font-semibold">Approve the payment on your phone</span>
            <span className="text-muted-foreground">
              Enter your mobile money PIN when it asks. This page updates by itself.
            </span>
          </p>
        </div>
      ) : null}
      {attempt && (attempt.status === "failed" || attempt.status === "expired") ? (
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden />
          <AlertDescription>
            {attempt.failureReason ?? "That payment did not go through."} You have not been charged;
            try again.
          </AlertDescription>
        </Alert>
      ) : null}
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setTried(true);
          if (method === "momo" && phoneError) return document.getElementById("pay-phone")?.focus();
          pay.mutate();
        }}
      >
        <RadioGroup
          value={method}
          onValueChange={(value) => setMethod(value as Method)}
          aria-label="How you pay"
          className="grid gap-2 sm:grid-cols-2"
        >
          {(
            [
              ["momo", "Mobile money", Smartphone],
              ["card", "Card", CreditCard],
            ] as const
          ).map(([value, label, Icon]) => (
            <label
              key={value}
              htmlFor={`pay-${value}`}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-shop-glow has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
            >
              <RadioGroupItem id={`pay-${value}`} value={value} />
              <Icon aria-hidden className="size-5 text-primary" />
              <span className="font-semibold">{label}</span>
            </label>
          ))}
        </RadioGroup>
        {method === "momo" ? (
          <div className="space-y-4">
            <RadioGroup
              value={network}
              onValueChange={(value) => setNetwork(value as typeof network)}
              aria-label="Network"
              className="grid grid-cols-3 gap-2"
            >
              {networks.map(([value, label]) => (
                <label
                  key={value}
                  htmlFor={`network-${value}`}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-2 py-2.5 text-sm font-semibold has-[:checked]:border-primary has-[:checked]:bg-shop-glow has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
                >
                  <RadioGroupItem id={`network-${value}`} value={value} className="sr-only" />
                  {label}
                </label>
              ))}
            </RadioGroup>
            <DetailField
              id="pay-phone"
              label="Mobile money number"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="024 123 4567"
              description="We send the approval prompt to this number."
              value={phone}
              onChange={setPhone}
              error={tried ? phoneError : undefined}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            You will pay on Paystack's page, then come straight back here.
          </p>
        )}
        {pay.error ? (
          <Alert variant="destructive" role="alert">
            <CircleAlert aria-hidden />
            <AlertDescription>
              {refusal ? refusal.message : "We could not reach the shop. Try again."}
            </AlertDescription>
          </Alert>
        ) : null}
        <Button
          type="submit"
          size="touch"
          className="h-14 w-full rounded-2xl text-base font-bold"
          disabled={pay.isPending}
        >
          {pay.isPending ? <Loader2 aria-hidden className="animate-spin" /> : null}
          {pay.isPending ? "Starting your payment" : `Pay ${formatGHS(order.totals.gross)}`}
        </Button>
      </form>
    </section>
  );
}
