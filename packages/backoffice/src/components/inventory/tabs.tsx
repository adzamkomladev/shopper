import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shopper/ui/components/tabs";
import { focusIfIdle } from "../../lib/focus";
import type { PermissionCode } from "../../lib/roles/permissions";
import { usePermissions } from "../../queries/session/permissions";

type InventoryTab = "stock" | "suppliers";

// Each tab is shown only to members who hold its permission. Slices 9 and 10 add Records, Stock takes and Valuation.
const TABS: {
  value: InventoryTab;
  to: "/stock" | "/suppliers";
  label: string;
  need: PermissionCode;
}[] = [
  { value: "stock", to: "/stock", label: "Stock", need: "stock.read" },
  { value: "suppliers", to: "/suppliers", label: "Suppliers", need: "product.read" },
];

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
        tabIndex={-1}
        ref={focusIfIdle}
        className="text-3xl font-bold tracking-tight outline-none"
      >
        Inventory
      </h1>
      <Tabs value={active} activationMode="manual" className="min-h-0 flex-1 gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {tabs.length > 0 && (
            <TabsList aria-label="Inventory">
              {tabs.map(({ value, to, label }) => (
                <TabsTrigger key={value} value={value} asChild className="px-4">
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
