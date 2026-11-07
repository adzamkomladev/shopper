import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Loader2, Store, Truck } from "lucide-react";
import { formatGHS } from "@shopper/money";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { RadioGroup, RadioGroupItem } from "@shopper/ui/components/radio-group";
import { ShopApiError, shopFetch } from "../../queries/api";
import { cartQuery } from "../../queries/checkout";
import { placedOrder, type FulfilmentOptions } from "../../schemas/checkout";
import { clearCart, type CartLine } from "../../stores/cart";
import { CartTotals } from "../cart/totals";
import { Turnstile } from "../signin/turnstile";
import { DetailField } from "./details";
import { phoneOf } from "../shop/phone";
import { SlotPicker } from "./slots";

type Kind = "pickup" | "delivery";

/**
 * Guest checkout: pickup or delivery (only what the branch offers), a slot, who is collecting, and where to deliver.
 * The checkout key is made once per visit, so a double tap or a retry after a dropped reply places one order.
 */
export function CheckoutForm({
  shop,
  branchId,
  lines,
  options,
  siteKey,
}: {
  shop: string;
  branchId: string;
  lines: CartLine[];
  options: FulfilmentOptions;
  siteKey: string | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [key] = useState(() => crypto.randomUUID());
  const [kind, setKind] = useState<Kind>(options.pickup ? "pickup" : "delivery");
  const [slot, setSlot] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState({ line1: "", area: "", city: "", landmark: "" });
  const [token, setToken] = useState("");
  // A Turnstile token is single use: every refused submit draws a fresh challenge.
  const [challenge, setChallenge] = useState(0);
  const [tried, setTried] = useState(false);
  const quote = useQuery(cartQuery(shop, branchId, lines, kind));
  const place = useMutation({
    mutationFn: () =>
      shopFetch(`/${shop}/orders`, placedOrder, {
        body: {
          key,
          branch: branchId,
          lines,
          fulfilment: kind,
          slot,
          name: name.trim(),
          phone: phoneOf(phone),
          email: email.trim(),
          address: kind === "delivery" ? address : undefined,
          turnstile: token,
        },
      }),
    onSuccess: (order) => {
      clearCart(shop);
      void navigate({
        to: "/$shop/orders/$id",
        params: { shop, id: order.id },
        search: { t: key },
      });
    },
    onError: (error) => {
      setToken("");
      setChallenge((count) => count + 1);
      // A slot that filled meanwhile: show the fresh places so the shopper can pick again.
      if (error instanceof ShopApiError && error.code === "slot") {
        setSlot("");
        void queryClient.invalidateQueries({ queryKey: [shop, "fulfilment"] });
      }
      if (error instanceof ShopApiError && error.code === "stock")
        void queryClient.invalidateQueries({ queryKey: [shop, "cart"] });
    },
  });
  const errors = {
    slot: slot ? undefined : "Choose a time",
    name: name.trim() ? undefined : "Enter your name",
    phone: /^0\d{9}$/.test(phoneOf(phone)) ? undefined : "Enter a Ghana number like 024 123 4567",
    email: !email.trim() || /^\S+@\S+\.\S+$/.test(email.trim()) ? undefined : "Enter a valid email",
    line1: kind === "pickup" || address.line1.trim() ? undefined : "Enter the street or house",
    area: kind === "pickup" || address.area.trim() ? undefined : "Enter the area",
    city: kind === "pickup" || address.city.trim() ? undefined : "Enter the town or city",
  };
  const shown = (field: keyof typeof errors) => (tried ? errors[field] : undefined);
  const refusal = place.error instanceof ShopApiError ? place.error : null;
  return (
    <form
      noValidate
      className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start"
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        const first = Object.entries(errors).find(([, message]) => message)?.[0];
        if (first)
          return document.getElementById(first === "slot" ? "slot-heading" : first)?.focus();
        place.mutate();
      }}
    >
      <div className="space-y-6">
        <section
          aria-labelledby="kind-heading"
          className="space-y-3 rounded-panel border bg-card p-5"
        >
          <h2 id="kind-heading" className="text-lg font-bold">
            How you get it
          </h2>
          <RadioGroup
            value={kind}
            onValueChange={(value) => setKind(value as Kind)}
            aria-labelledby="kind-heading"
            className="grid gap-2 sm:grid-cols-2"
          >
            {(["pickup", "delivery"] as const)
              .filter((option) => options[option])
              .map((option) => (
                <label
                  key={option}
                  htmlFor={`kind-${option}`}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-shop-glow has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
                >
                  <RadioGroupItem id={`kind-${option}`} value={option} />
                  {option === "pickup" ? (
                    <Store aria-hidden className="size-5 text-primary" />
                  ) : (
                    <Truck aria-hidden className="size-5 text-primary" />
                  )}
                  <span>
                    <span className="block font-semibold">
                      {option === "pickup" ? `Pick up at ${options.branch.name}` : "Deliver to me"}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {option === "pickup" ? "Free" : `${formatGHS(options.deliveryFee)} delivery`}
                    </span>
                  </span>
                </label>
              ))}
          </RadioGroup>
        </section>
        <section
          aria-labelledby="slot-heading"
          className="space-y-3 rounded-panel border bg-card p-5"
        >
          <h2 id="slot-heading" tabIndex={-1} className="text-lg font-bold outline-none">
            When
          </h2>
          {options.slots.length ? (
            <SlotPicker slots={options.slots} value={slot} onChange={setSlot} />
          ) : (
            <p className="text-muted-foreground">No times are open in the next three days.</p>
          )}
          {shown("slot") ? (
            <p className="text-sm font-semibold text-destructive">{shown("slot")}</p>
          ) : null}
        </section>
        <section
          aria-labelledby="who-heading"
          className="space-y-4 rounded-panel border bg-card p-5"
        >
          <h2 id="who-heading" className="text-lg font-bold">
            Your details
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField
              id="name"
              label="Name"
              autoComplete="name"
              value={name}
              onChange={setName}
              error={shown("name")}
            />
            <DetailField
              id="phone"
              label="Phone number"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="024 123 4567"
              description="The shop calls this number about your order."
              value={phone}
              onChange={setPhone}
              error={shown("phone")}
            />
            <DetailField
              id="email"
              label="Email (optional)"
              type="email"
              inputMode="email"
              autoComplete="email"
              description="We email your receipt here."
              value={email}
              onChange={setEmail}
              error={shown("email")}
            />
          </div>
          {kind === "delivery" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["line1", "Street or house", "street-address"],
                  ["area", "Area", "address-level3"],
                  ["city", "Town or city", "address-level2"],
                  ["landmark", "Landmark (optional)", "off"],
                ] as const
              ).map(([field, label, autoComplete]) => (
                <DetailField
                  key={field}
                  id={field}
                  label={label}
                  autoComplete={autoComplete}
                  value={address[field]}
                  onChange={(value) => setAddress((current) => ({ ...current, [field]: value }))}
                  error={field === "landmark" ? undefined : shown(field)}
                />
              ))}
            </div>
          ) : null}
        </section>
      </div>
      <CartTotals quote={quote.data} pricing={quote.isFetching}>
        {place.error ? (
          <Alert variant="destructive" role="alert">
            <CircleAlert aria-hidden />
            <AlertDescription>
              {!refusal
                ? "We could not reach the shop. Check your connection, then place your order again: it is only ever placed once."
                : refusal.status === 429
                  ? "Too many tries. Wait a minute, then place your order."
                  : refusal.message}
              {refusal?.code === "stock" ? (
                <Link
                  to="/$shop/cart"
                  params={{ shop }}
                  search={{ branch: branchId }}
                  className="font-semibold underline"
                >
                  Review your cart
                </Link>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        {siteKey ? <Turnstile key={challenge} siteKey={siteKey} onToken={setToken} /> : null}
        <Button
          type="submit"
          size="touch"
          className="h-14 w-full rounded-2xl text-base font-bold"
          disabled={place.isPending || !quote.data || (siteKey !== null && !token)}
        >
          {place.isPending ? <Loader2 aria-hidden className="animate-spin" /> : null}
          {place.isPending ? "Placing your order" : "Place order"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Your items are kept for 30 minutes while you pay.
        </p>
      </CartTotals>
    </form>
  );
}
