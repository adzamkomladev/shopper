import { Sparkles } from "lucide-react";
import type { ShopPoints } from "../../schemas/shop";
import { shopDate } from "../shop/phone";

/** The points card: the balance counts up from zero, the tier sits beside it, the last movement below. */
export function PointsCard({ points }: { points: ShopPoints }) {
  const last = points.entries[0];
  // CSS counters cannot group digits, so a balance from 1,000 counts its thousands and the rest apart.
  const grouped = points.points >= 1000 && points.points < 1_000_000;
  return (
    <section
      aria-labelledby="points-title"
      className="relative animate-rise overflow-hidden rounded-panel bg-primary p-6 text-primary-foreground shadow-xl shadow-primary/25"
    >
      <span
        aria-hidden
        className="absolute -top-16 -right-12 size-48 rounded-full bg-primary-foreground/10"
      />
      <span
        aria-hidden
        className="absolute -bottom-20 -left-10 size-40 rounded-full bg-primary-foreground/5"
      />
      <div className="relative flex items-center justify-between gap-3">
        <h2 id="points-title" className="font-semibold opacity-90">
          Your points
        </h2>
        {points.tier ? (
          <span className="inline-flex animate-pop items-center gap-1 rounded-full bg-primary-foreground px-3 py-1 text-sm font-bold text-primary">
            <Sparkles aria-hidden className="size-4" />
            {points.tier.name}
          </span>
        ) : null}
      </div>
      <p className="relative mt-3 text-7xl leading-none font-black tracking-tighter tabular-nums">
        <span className="sr-only">{points.points.toLocaleString("en-GB")}</span>
        <span
          aria-hidden
          className={grouped ? "count-up-grouped" : "count-up"}
          style={
            {
              "--count-thousands": Math.trunc(points.points / 1000),
              "--count": grouped ? points.points % 1000 : points.points,
            } as React.CSSProperties
          }
        />
      </p>
      <p className="relative mt-4 text-sm opacity-85">
        {last
          ? `${last.points > 0 ? "+" : ""}${last.points.toLocaleString("en-GB")} on ${shopDate(last.occurredAt)}`
          : "Give your number at the till to earn points on every visit."}
      </p>
    </section>
  );
}
