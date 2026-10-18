/// <reference types="vite-plus/client" />
import "../src/styles.css";
import { createRoot } from "react-dom/client";
import { money } from "@shopper/money";
import { DisplayScreen } from "../src/screens/display/screen";
import type { DisplaySnapshot } from "../src/display/types";
import { basket, emptyView, items } from "./fixtures";

// Test-only: the customer display with fixture data, picked by ?scenario=.
const base: DisplaySnapshot = { closed: false, storeName: "Accra Central", view: null, sold: null };
const many = Array.from({ length: 16 }, (_, index) => ({
  ...items[index % items.length]!,
  id: `many-${index}`,
  name: `${items[index % items.length]!.name} (${index + 1})`,
}));
const longName = {
  ...items[0]!,
  id: "long",
  name: "Fan Milk Vanilla ice cream family tub with chocolate chips and crunchy wafer pieces",
};

const scenarios: Record<string, DisplaySnapshot> = {
  idle: { ...base, view: emptyView },
  lines: { ...base, view: basket(items.slice(0, 5)) },
  long: { ...base, view: basket([items[1]!, longName]) },
  many: { ...base, view: basket(many) },
  paid: { ...base, sold: { total: money(600_000), change: money(94_600) } },
  exact: { ...base, sold: { total: money(600_000), change: money(0) } },
  closed: { ...base, closed: true },
};
const name = new URLSearchParams(location.search).get("scenario") ?? "idle";

createRoot(document.getElementById("root")!).render(
  <DisplayScreen snapshot={scenarios[name] ?? scenarios.idle!} />,
);
