import { formatGHS, money } from "@shopper/money";

export function DisplayTotal({ total, count }: { total: number; count: number }) {
  return (
    <section
      aria-label="Total"
      className="flex w-160 shrink-0 flex-col justify-end gap-3 rounded-3xl bg-primary p-14 leading-none text-primary-foreground"
    >
      <p className="text-4xl font-semibold tracking-tight">Total</p>
      <p className="truncate text-7xl font-bold tracking-tight tabular-nums">
        {formatGHS(money(total))}
      </p>
      <p className="text-3xl font-medium tracking-tight">
        {count} {count === 1 ? "item" : "items"}
      </p>
    </section>
  );
}
