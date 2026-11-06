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
 * The store's bar: the shop's name back to its first page, the branch the prices and stock are for, and the
 * shopper's account. Changing branch keeps the page the shopper is on.
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
    <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          to="/$shop"
          params={{ shop }}
          search={{ branch: branchId }}
          className="min-w-0 truncate text-lg font-black tracking-tight sm:text-xl"
        >
          {info.name}
        </Link>
        <div className="ml-auto flex items-center gap-2">
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
                className="h-11 max-w-44 rounded-full bg-card font-semibold sm:max-w-none"
              >
                <MapPin aria-hidden className="size-4 text-primary" />
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
            <span className="hidden items-center gap-1.5 text-sm font-semibold text-muted-foreground sm:flex">
              <MapPin aria-hidden className="size-4 text-primary" />
              {info.branches[0]?.name}
            </span>
          )}
          <CartButton shop={shop} branchId={branchId} />
          <Button
            asChild
            variant="outline"
            className="h-11 rounded-full bg-card px-3 font-semibold sm:px-4"
          >
            <Link to="/$shop/account" params={{ shop }} aria-label="Your account">
              <UserRound aria-hidden className="size-5" />
              <span className="hidden sm:inline">Account</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
