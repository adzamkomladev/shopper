import { Button } from "@shopper/ui/components/button";
import { UserRound } from "lucide-react";
import type { ShopAccount } from "../../schemas/shop";

/** Who is signed in and where, with the "You" button that opens their details. */
export function AccountHeader({ account, onYou }: { account: ShopAccount; onYou: () => void }) {
  const first = account.name?.split(" ")[0];
  return (
    <header className="flex items-start justify-between gap-4 pt-8 pb-6">
      <div className="min-w-0 space-y-1">
        <p className="truncate font-semibold text-muted-foreground">{account.shop.name}</p>
        <h1 className="text-4xl font-black tracking-tight text-balance">
          {first ? `Hi, ${first}` : "Hi there"}
        </h1>
      </div>
      <Button
        variant="outline"
        className="h-12 shrink-0 rounded-full bg-card px-4 font-semibold shadow-sm"
        aria-keyshortcuts="Y"
        onClick={onYou}
      >
        <UserRound aria-hidden className="size-5" />
        You
      </Button>
    </header>
  );
}
