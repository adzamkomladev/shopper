import { CircleCheckIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { CardContent } from "@shopper/ui/components/card";
import { focusOnMount } from "../../../lib/focus";
import { currentShop } from "../../../shops/store";

export function LoginSuccess({ onContinue }: { onContinue: () => void }) {
  const shop = currentShop();
  return (
    <CardContent className="flex flex-col items-center gap-9 px-6 text-center sm:px-22">
      <CircleCheckIcon
        aria-hidden
        className="size-27 fill-success text-success-foreground [&>circle]:stroke-success"
      />
      <div className="flex flex-col gap-5">
        <h1 className="text-4xl font-semibold tracking-tight">You're signed in</h1>
        <p className="text-lg font-medium">
          {shop ? `You're signed in to ${shop.name}.` : "You can now use the back office."}
        </p>
      </div>
      <Button size="lg" className="w-full rounded-full" onClick={onContinue} ref={focusOnMount}>
        Continue to products
      </Button>
    </CardContent>
  );
}
