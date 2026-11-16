import { Link, useNavigate } from "@tanstack/react-router";
import { MapPin, UserRound } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shopper/ui/components/select";
import type { StoreInfo } from "../../schemas/store";
import { CartButton } from "../cart/button";

/**
 * The store's bar: a line on prices and payment, the shop's name back to its first page, the branch the prices
 * and stock are for, the account and the cart. Changing branch keeps the page the shopper is on.
 */
export function StoreHeader({
  shop,
  info,
  branchId,
}: {
  shop: string;
  info: StoreInfo;
  branchId: string;
}) {
  const navigate = useNavigate();
  return (
    <>
      <p className="bg-shop-ink px-4 py-2 text-center text-xs font-medium text-shop-on-ink">
        In-store prices online <span aria-hidden>·</span> Pay with mobile money
      </p>
      <header className="sticky top-0 z-20 border-b bg-shop-page/90 backdrop-blur supports-[backdrop-filter]:bg-shop-page/75">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">
          <Link
            to="/$shop"
            params={{ shop }}
            search={{ branch: branchId }}
            className="min-w-0 truncate text-lg font-bold tracking-tight sm:text-xl"
          >
            {info.name}
          </Link>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {info.branches.length > 1 ? (
              <Select
                value={branchId}
                onValueChange={(branch) =>
                  void navigate({
                    to: ".",
                    search: (previous: Record<string, unknown>) => ({
                      ...previous,
                      branch,
                      page: undefined,
                    }),
                  })
                }
              >
                <SelectTrigger
                  aria-label="Branch"
                  className="h-10 max-w-40 rounded-full border-transparent bg-transparent font-medium shadow-none hover:bg-shop-glow sm:max-w-none"
                >
                  <MapPin aria-hidden className="size-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {info.branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="hidden items-center gap-1.5 px-2 text-sm font-medium text-muted-foreground sm:flex">
                <MapPin aria-hidden className="size-4" />
                {info.branches[0]?.name}
              </span>
            )}
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="size-10 rounded-full hover:bg-shop-glow"
            >
              <Link to="/$shop/account" params={{ shop }} aria-label="Your account">
                <UserRound aria-hidden className="size-5" />
              </Link>
            </Button>
            <CartButton shop={shop} branchId={branchId} />
          </div>
        </div>
      </header>
    </>
  );
}
