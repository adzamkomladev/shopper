import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shopper/ui/components/tabs";
import { TENANT_TABS } from "../../../schemas/tenant";
import type { TenantTab } from "../../../schemas/types";

export const TAB_LABELS: Record<TenantTab, string> = {
  overview: "Overview",
  stores: "Stores",
  products: "Products",
  staff: "Staff",
  verification: "Verification",
  billing: "Billing",
  activity: "Activity",
};

/** One tab per part of the shop, each a link so the address keeps it; the list scrolls sideways on a phone. */
export function TenantTabs({
  orgId,
  active,
  children,
}: {
  orgId: string;
  active: TenantTab;
  children: React.ReactNode;
}) {
  return (
    <Tabs value={active} activationMode="manual" className="gap-6">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList variant="line" aria-label="Shop details">
          {TENANT_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} asChild>
              <Link to="/tenants/$orgId" params={{ orgId }} search={{ tab }} replace>
                {TAB_LABELS[tab]}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value={active} className="flex flex-col gap-6">
        {children}
      </TabsContent>
    </Tabs>
  );
}
