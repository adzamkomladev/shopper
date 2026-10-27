import { formatGHS, money } from "@shopper/money";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shopper/ui/components/card";
import type { DashboardView } from "../../../schemas/reports/views";

/** Sales by Accra hour, today beside yesterday, over the hours either day traded (plain CSS bars). */
export function HourBars({ hours }: Pick<DashboardView, "hours">) {
  const traded = hours.filter((hour) => hour.today !== 0 || hour.yesterday !== 0);
  const shown = traded.length ? hours.slice(traded[0]!.hour, traded.at(-1)!.hour + 1) : [];
  const top = Math.max(
    1,
    ...shown.flatMap((hour) => [Math.abs(hour.today), Math.abs(hour.yesterday)]),
  );
  // An hour that refunded more than it sold draws its size in the destructive colour.
  const bar = (amount: number, colour: string) => (
    <span
      className={`w-1/2 max-w-4 rounded-t-sm ${amount < 0 ? "bg-destructive" : colour}`}
      style={{ height: `${(Math.abs(amount) / top) * 100}%` }}
    />
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales by hour</CardTitle>
        <CardDescription className="flex items-center gap-4">
          <Key className="bg-primary">Today</Key>
          <Key className="bg-muted-foreground/30">Yesterday</Key>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sales on either day.</p>
        ) : (
          <ol aria-label="Sales by hour" className="flex h-48 items-stretch gap-0.5 sm:gap-2">
            {shown.map((hour) => {
              const at = `${String(hour.hour).padStart(2, "0")}:00`;
              return (
                <li
                  key={hour.hour}
                  aria-label={`${at}: ${formatGHS(money(hour.today))} today, ${formatGHS(money(hour.yesterday))} yesterday`}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1"
                >
                  <span aria-hidden className="flex w-full flex-1 items-end justify-center gap-0.5">
                    {bar(hour.today, "bg-primary")}
                    {bar(hour.yesterday, "bg-muted-foreground/30")}
                  </span>
                  <span
                    aria-hidden
                    // On a phone a full day leaves no room for every label, so every other hour is named.
                    className={`text-xs text-muted-foreground tabular-nums ${hour.hour % 2 ? "max-sm:invisible" : ""}`}
                  >
                    {String(hour.hour).padStart(2, "0")}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function Key({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`size-2.5 rounded-sm ${className}`} />
      {children}
    </span>
  );
}
