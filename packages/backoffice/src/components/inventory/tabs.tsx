import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shopper/ui/components/tabs";
import { focusIfIdle } from "../../lib/focus";
import type { PermissionCode } from "../../lib/roles/permissions";
import { usePermissions } from "../../queries/session/permissions";

type InventoryTab = "stock" | "records" | "takes" | "valuation" | "suppliers";

// Each tab is shown only to members who hold its permission.
const TABS: {
  value: InventoryTab;
  to: "/stock" | "/stock/records" | "/stock/takes" | "/stock/valuation" | "/suppliers";
  label: string;
  need: PermissionCode;
}[] = [
  { value: "stock", to: "/stock", label: "Stock", need: "stock.read" },
  { value: "records", to: "/stock/records", label: "Records", need: "stock.read" },
  { value: "takes", to: "/stock/takes", label: "Stock takes", need: "stock.read" },
  { value: "valuation", to: "/stock/valuation", label: "Valuation", need: "stock.read" },
  { value: "suppliers", to: "/suppliers", label: "Suppliers", need: "product.read" },
];

const revealTab = (node: HTMLElement | null) =>
  node?.scrollIntoView({ inline: "center", block: "nearest" });

type Props = {
  active: InventoryTab;
  /** The tab's primary button, at the end of the tab bar. */
  action?: React.ReactNode;
  children: React.ReactNode;
};

/** The inventory area's heading and tab bar (Figma 227:4900 tab pattern); `children` is the active tab's content. */
export function InventoryPage({ active, action, children }: Props) {
  const held = usePermissions();
  const tabs = TABS.filter(({ need }) => held?.includes(need));
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {/* Focused on arrival, so the screen's shortcuts work straight after navigating here. */}
      <h1
        id="inventory-heading"
        tabIndex={-1}
        ref={focusIfIdle}
        className="text-3xl font-bold tracking-tight outline-none"
      >
        Inventory
      </h1>
      <Tabs value={active} activationMode="manual" className="min-h-0 flex-1 gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {tabs.length > 0 && (
            // Five tabs are wider than a phone: the strip scrolls, and the tab showing is brought into view.
            <TabsList aria-label="Inventory" className="max-w-full justify-start overflow-x-auto">
              {tabs.map(({ value, to, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  asChild
                  ref={value === active ? revealTab : undefined}
                  className="px-3 sm:px-4"
                >
                  <Link to={to}>{label}</Link>
                </TabsTrigger>
              ))}
            </TabsList>
          )}
          {action}
        </div>
        <TabsContent value={active} className="flex min-h-0 flex-1 flex-col gap-6">
          {children}
        </TabsContent>
      </Tabs>
    </div>
  );
}
