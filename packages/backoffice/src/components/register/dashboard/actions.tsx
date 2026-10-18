import { Activity, Box, ChevronRight, FileText, type LucideIcon } from "lucide-react";
import { Separator } from "@shopper/ui/components/separator";

import type { DashboardTarget } from "./types";

const actions: {
  target: DashboardTarget;
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    target: "sale",
    icon: FileText,
    title: "Barcode Scanner",
    description: "Scan product barcodes to quickly add items to a sale.",
  },
  {
    target: "inventory",
    icon: Box,
    title: "Inventory Management",
    description: "Count stock and record deliveries, even while offline.",
  },
  {
    target: "reports",
    icon: Activity,
    title: "Sales Reports",
    description: "Generate detailed reports on sales performance and trends.",
  },
];

/** Figma "Quick Actions": each row opens the tab that does the job. `shown` hides tabs this user cannot open. */
export function QuickActions({
  shown,
  onOpen,
}: {
  shown: readonly DashboardTarget[];
  onOpen: (target: DashboardTarget) => void;
}) {
  return (
    <section
      aria-labelledby="quick-actions"
      className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm"
    >
      <div className="flex flex-col gap-1.5 p-4">
        <h2 className="text-lg leading-none font-semibold tracking-tight" id="quick-actions">
          Quick Actions
        </h2>
        <p className="text-sm font-medium text-muted-foreground">
          Access your most-used POS tools and actions in one place.
        </p>
      </div>
      <Separator />
      <ul className="flex flex-col gap-2 p-4">
        {actions
          .filter((action) => shown.includes(action.target))
          .map(({ target, icon: Icon, title, description }) => (
            <li key={target}>
              <button
                className="outline-none focus-visible:focus-ring flex min-h-20 w-full items-center gap-3 rounded-xl border bg-card px-2.5 py-2 text-left hover:bg-accent"
                onClick={() => onOpen(target)}
                type="button"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{title}</span>
                  <span className="block text-xs text-muted-foreground">{description}</span>
                </span>
                <ChevronRight aria-hidden className="mx-1.5 size-4 shrink-0" />
              </button>
            </li>
          ))}
      </ul>
    </section>
  );
}
