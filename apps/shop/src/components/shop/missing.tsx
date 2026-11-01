import { Button } from "@shopper/ui/components/button";
import { SearchX } from "lucide-react";

/** A whole-page dead end that says what to do next: an unknown shop, page or receipt, or a failed load. */
export function Missing({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="flex size-16 animate-pop items-center justify-center rounded-full bg-shop-glow text-primary">
        <SearchX aria-hidden className="size-7" />
      </span>
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-balance">{title}</h1>
        <p className="text-pretty text-muted-foreground">{description}</p>
      </div>
      {action ? (
        <Button size="touch" className="rounded-full px-8" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </main>
  );
}
