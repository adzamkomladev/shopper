import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@shopper/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@shopper/ui/components/sheet";
import { useMobile } from "@shopper/ui/hooks/use-mobile";
import { Loader2, LogOut } from "lucide-react";
import { shopFetch } from "../../queries/api";
import { noContent, type ShopAccount } from "../../schemas/shop";
import { maskPhone } from "../shop/phone";
import { Addresses } from "./addresses";
import { Profile } from "./profile";

/** The shopper's own details: name and email, delivery addresses and signing out. Slides up on phones. */
export function YouSheet({
  shop,
  account,
  open,
  onOpenChange,
}: {
  shop: string;
  account: ShopAccount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mobile = useMobile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signOut = useMutation({
    mutationFn: () => shopFetch("/signout", noContent, { body: {} }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: [shop] });
      void navigate({ to: "/$shop/signin", params: { shop } });
    },
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={mobile ? "bottom" : "right"}
        className={
          mobile
            ? "max-h-dvh overflow-y-auto rounded-t-panel px-5 pb-8"
            : "w-full overflow-y-auto px-6 pb-8 sm:max-w-md"
        }
      >
        <SheetHeader className="px-0 pt-6">
          <SheetTitle className="text-2xl font-extrabold tracking-tight">You</SheetTitle>
          <SheetDescription>Signed in as {maskPhone(account.phone)}</SheetDescription>
        </SheetHeader>
        <Profile shop={shop} account={account} />
        <Addresses shop={shop} phone={account.phone} />
        <Button
          variant="outline"
          size="touch"
          className="mt-2 w-full rounded-2xl font-semibold"
          disabled={signOut.isPending}
          onClick={() => signOut.mutate()}
        >
          {signOut.isPending ? (
            <Loader2 aria-hidden className="animate-spin" />
          ) : (
            <LogOut aria-hidden />
          )}
          Sign out
        </Button>
      </SheetContent>
    </Sheet>
  );
}
