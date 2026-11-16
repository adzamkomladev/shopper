import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { focusOnMount, shiftTime } from "@shopper/backoffice/kit";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import type { TenantDetail } from "../../../schemas/types";

export function TenantHeader({ shop }: { shop: TenantDetail["overview"] }) {
  return (
    <header className="flex flex-col gap-3">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start text-muted-foreground">
        <Link to="/tenants">
          <ArrowLeftIcon aria-hidden />
          Back to shops
        </Link>
      </Button>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1
          tabIndex={-1}
          ref={focusOnMount}
          className="text-2xl font-semibold tracking-tight wrap-break-word outline-none"
        >
          {shop.name}
        </h1>
        <Badge variant={shop.onboarding === "trading" ? "secondary" : "outline"}>
          {shop.onboarding === "trading"
            ? "Trading"
            : shop.onboarding
              ? "Setting up"
              : "Onboarding not tracked"}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {shop.code ? `Shop code ${shop.code} · ` : ""}Joined {shiftTime(shop.createdAt)}
      </p>
    </header>
  );
}

/** Headline numbers, two to a row on a phone and four on a laptop. */
export function Stats({ items }: { items: [label: string, value: React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="flex min-w-0 flex-col gap-1 rounded-lg border bg-card p-4 shadow-sm"
        >
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-xl font-semibold tabular-nums wrap-break-word">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Label and value pairs, one column on a phone and two from a tablet. */
export function Facts({ rows }: { rows: [label: string, value: React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="font-medium wrap-break-word">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
