import { useQuery } from "@tanstack/react-query";
import { TagIcon } from "lucide-react";
import { money } from "@shopper/money";
import { Button } from "@shopper/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shopper/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { Kbd } from "@shopper/ui/components/kbd";
import { Money } from "@shopper/ui/components/money";
import { useNow } from "@shopper/ui/hooks/use-now";
import { formatDate, formatDateTime, groupPrices } from "./groups";
import { PriceRow } from "./row";
import { branchesQuery, type PriceView, type ProductDetail } from "../queries";

const CLOCK_MS = 30_000;

type Props = {
  product: ProductDetail;
  /** When the product was fetched. A price saved just now starts after the clock's last tick. */
  fetchedAt: number;
  setPriceRef: React.Ref<HTMLButtonElement>;
  onSetPrice: () => void;
  onSchedule: () => void;
};

export function PricesCard({ product, fetchedAt, setPriceRef, onSetPrice, onSchedule }: Props) {
  // Roles without branch.read get no names; their branch prices read "Branch".
  const { data: branches } = useQuery(branchesQuery());
  const now = useNow(CLOCK_MS);
  const scopeOf = (price: PriceView) =>
    price.branchId
      ? (branches?.find((branch) => branch.id === price.branchId)?.name ?? "Branch")
      : "All branches";
  const { current, overrides, returning, upcoming, history } = groupPrices(
    product.prices,
    Math.max(now, fetchedAt),
  );
  return (
    <Card role="region" aria-labelledby="prices-title">
      <CardHeader>
        <CardTitle id="prices-title" role="heading" aria-level={2}>
          Prices
        </CardTitle>
        <CardDescription>Every price change is kept with its date and reason.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-2">
          <Button ref={setPriceRef} type="button" variant="outline" onClick={onSetPrice}>
            Set price
            <Kbd aria-hidden>P</Kbd>
          </Button>
          <Button type="button" variant="outline" onClick={onSchedule}>
            Schedule price
          </Button>
        </div>
        {current ? (
          <div className="flex flex-col gap-1">
            <Money
              amount={money(current.amount)}
              className="text-left text-3xl font-semibold tracking-tight"
            />
            <p className="text-sm text-muted-foreground">
              All branches, since {formatDate(current.validFrom)}
              {current.validTo && `, until ${formatDateTime(current.validTo)}`}
            </p>
            {current.reason && <p className="text-sm text-muted-foreground">{current.reason}</p>}
          </div>
        ) : (
          <NoPrice hasOverrides={overrides.length > 0} />
        )}
        <Section title="Branch prices" prices={overrides} scopeOf={scopeOf} />
        <Section title="Upcoming" prices={upcoming} scopeOf={scopeOf} />
        <Section title="Returns after the window" prices={returning} scopeOf={scopeOf} />
        <Section title="History" prices={history} scopeOf={scopeOf} />
      </CardContent>
    </Card>
  );
}

function NoPrice({ hasOverrides }: { hasOverrides: boolean }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TagIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>No price yet</EmptyTitle>
        <EmptyDescription>
          {hasOverrides
            ? "Only some branches have a price. Set one for all branches."
            : "Set a price so this product can be sold."}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

type SectionProps = { title: string; prices: PriceView[]; scopeOf: (price: PriceView) => string };

function Section({ title, prices, scopeOf }: SectionProps) {
  if (prices.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="divide-y rounded-lg border">
        {prices.map((price) => (
          <PriceRow key={price.id} price={price} scope={scopeOf(price)} />
        ))}
      </ul>
    </section>
  );
}
