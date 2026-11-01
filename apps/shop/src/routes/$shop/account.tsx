import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { signInWhenRefused } from "../../queries/api";
import { accountQuery, pointsQuery, receiptsQuery } from "../../queries/account";
import { AccountHeader } from "../../components/account/header";
import { PointsCard } from "../../components/account/points";
import { Receipts } from "../../components/account/receipts";
import { AccountSkeleton } from "../../components/account/skeleton";
import { YouSheet } from "../../components/you/sheet";
import { Missing } from "../../components/shop/missing";
import { pageRef } from "../../components/shop/focus";

/** The shopper's data loads in the browser, never on the server; a signed-out browser goes to sign in. */
export const Route = createFileRoute("/$shop/account")({
  ssr: false,
  // The account answers first, so a signed-out browser makes one refused request rather than three.
  loader: ({ context, params }) =>
    context.queryClient
      .ensureQueryData(accountQuery(params.shop))
      .then(() =>
        Promise.all([
          context.queryClient.ensureQueryData(pointsQuery(params.shop)),
          context.queryClient.ensureQueryData(receiptsQuery(params.shop)),
        ]),
      )
      .catch(signInWhenRefused(params.shop)),
  pendingComponent: AccountSkeleton,
  errorComponent: AccountError,
  component: Account,
});

function Account() {
  const { shop } = Route.useParams();
  const account = useSuspenseQuery(accountQuery(shop)).data;
  const points = useSuspenseQuery(pointsQuery(shop)).data;
  const receipts = useSuspenseQuery(receiptsQuery(shop)).data;
  const [you, setYou] = useState(false);
  const shortcuts = useShortcuts({ Y: () => setYou(true) });
  return (
    <main
      ref={pageRef(shortcuts)}
      tabIndex={-1}
      className="mx-auto outline-none max-w-xl px-5 pb-16"
    >
      <AccountHeader account={account} onYou={() => setYou(true)} />
      {points.enabled ? <PointsCard points={points} /> : null}
      <Receipts shop={shop} items={receipts.items} phone={account.phone} />
      <YouSheet shop={shop} account={account} open={you} onOpenChange={setYou} />
    </main>
  );
}

function AccountError({ reset }: { reset: () => void }) {
  const router = useRouter();
  return (
    <Missing
      title="We could not load your account"
      description="Check your connection, then try again."
      action={{
        label: "Try again",
        onClick: () => {
          reset();
          void router.invalidate();
        },
      }}
    />
  );
}
