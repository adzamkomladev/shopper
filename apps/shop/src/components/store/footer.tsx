import { Link } from "@tanstack/react-router";

/** The foot of every store page: who the shop is, where its prices come from, and the shopper's own pages. */
export function StoreFooter({
  shop,
  name,
  branchId,
}: {
  shop: string;
  name: string;
  branchId: string;
}) {
  const link = "text-sm text-muted-foreground hover:text-foreground";
  return (
    <footer className="mt-16 border-t bg-card">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
        <div className="max-w-sm space-y-2">
          <p className="text-lg font-bold tracking-tight">{name}</p>
          <p className="text-sm text-pretty text-muted-foreground">
            The same prices and stock as in store, ready for delivery or pickup. Prices in Ghana
            cedis.
          </p>
        </div>
        <nav aria-label="Your pages" className="flex flex-col gap-2">
          <Link to="/$shop/account" params={{ shop }} className={link}>
            Your account
          </Link>
          <Link to="/$shop/cart" params={{ shop }} search={{ branch: branchId }} className={link}>
            Your cart
          </Link>
        </nav>
      </div>
    </footer>
  );
}
