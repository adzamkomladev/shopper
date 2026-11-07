import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { shopFetch, ShopApiError } from "../../queries/api";
import { placedOrder, type PlacedOrder } from "../../schemas/checkout";
import { CodeSlots } from "../signin/slots";

/**
 * The one-time code a mobile money network texts some payers before it prompts them. It goes on the sixth digit; the
 * payment then checks it, and a code it refused comes back as the reason, with the boxes ready for another.
 */
export function PayCode({
  shop,
  order,
  orderKey,
}: {
  shop: string;
  order: PlacedOrder;
  orderKey: string;
}) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const send = useMutation({
    mutationFn: (otp: string) =>
      shopFetch(`/${shop}/orders/${order.id}/pay/code`, placedOrder, {
        body: { key: orderKey, otp },
      }),
    onSettled: () => {
      setCode("");
      void queryClient.invalidateQueries({ queryKey: [shop, "orders", order.id] });
    },
  });
  const refused = order.payment?.failureReason;
  return (
    <div className="space-y-4">
      <p>
        <span className="block font-semibold">Enter the code your network sent</span>
        <span className="text-muted-foreground">
          It came by text to the number you are paying from. Then approve the payment on your phone.
        </span>
      </p>
      <CodeSlots
        key={refused ?? ""}
        code={code}
        invalid={Boolean(refused)}
        disabled={send.isPending}
      >
        <input
          aria-label="Payment code"
          aria-describedby="pay-code-message"
          aria-invalid={Boolean(refused) || undefined}
          className="absolute inset-0 size-full cursor-text rounded-2xl bg-transparent text-transparent caret-transparent outline-none"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          disabled={send.isPending}
          value={code}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(digits);
            if (digits.length === 6) send.mutate(digits);
          }}
        />
      </CodeSlots>
      <p
        id="pay-code-message"
        role="status"
        className={
          refused ? "text-sm font-medium text-destructive" : "text-sm text-muted-foreground"
        }
      >
        {send.isPending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 aria-hidden className="size-4 animate-spin" /> Checking your code
          </span>
        ) : (
          (refused ?? "Six digits. This page updates by itself once it is paid.")
        )}
      </p>
      {send.error ? (
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden />
          <AlertDescription>
            {send.error instanceof ShopApiError
              ? send.error.message
              : "We could not reach the shop. Try again."}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
