import {
  BanknoteIcon,
  PackageIcon,
  ReceiptIcon,
  ShoppingBasketIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  Undo2Icon,
  WalletIcon,
} from "lucide-react";
import { formatGHS, money } from "@shopper/money";
import { formatQuantity } from "@shopper/utils";
import { percent } from "../../../lib/reports/range";
import type { DashboardView } from "../../../schemas/reports/views";

type Kpis = DashboardView["kpis"];
type Figure = Kpis["netSales"];

const TILES = [
  { key: "netSales", label: "Net sales", icon: BanknoteIcon, show: "money" },
  { key: "transactions", label: "Transactions", icon: ReceiptIcon, show: "count" },
  { key: "basket", label: "Average basket", icon: ShoppingBasketIcon, show: "money" },
  { key: "itemsPerBasket", label: "Items per basket", icon: PackageIcon, show: "quantity" },
  // More refunds is worse news, so its rise reads in the warning colour.
  { key: "refunds", label: "Refunds", icon: Undo2Icon, show: "money", rising: "bad" },
  { key: "margin", label: "Margin", icon: WalletIcon, show: "money" },
] as const;

/** The day's six figures, each against yesterday's (Figma 339:9672's KPI tiles). */
export function KpiTiles({ kpis }: { kpis: Kpis }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {TILES.map((tile) => (
        <div key={tile.key} className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
          <dt className="flex items-center justify-between gap-2 text-sm font-medium">
            {tile.label}
            <tile.icon aria-hidden className="size-4 text-muted-foreground" />
          </dt>
          <dd className="text-2xl font-bold whitespace-nowrap tabular-nums">
            {value(kpis[tile.key], tile.show)}
          </dd>
          <dd className="text-xs text-muted-foreground">
            <Change figure={kpis[tile.key]} rising={"rising" in tile ? tile.rising : "good"} />
            {" vs yesterday ("}
            {value({ ...kpis[tile.key], value: kpis[tile.key].yesterday }, tile.show)})
          </dd>
        </div>
      ))}
    </dl>
  );
}

function value(figure: Figure, show: "money" | "count" | "quantity") {
  if (show === "money") return formatGHS(money(figure.value));
  if (show === "quantity") return formatQuantity(figure.value);
  return figure.value.toLocaleString("en-GB");
}

function Change({ figure, rising }: { figure: Figure; rising: "good" | "bad" }) {
  const text = percent(figure.changeBps);
  if (text === null || figure.changeBps === 0) return <span>{text ?? "Nothing to compare"}</span>;
  const up = figure.changeBps! > 0;
  const Icon = up ? TrendingUpIcon : TrendingDownIcon;
  return (
    // The colour is on the icon only: the success green on a card is too faint for text.
    <span className="inline-flex items-center gap-1 font-medium text-foreground">
      <Icon
        aria-hidden
        className={`size-3.5 ${up === (rising === "good") ? "text-success" : "text-destructive"}`}
      />
      {text}
    </span>
  );
}
