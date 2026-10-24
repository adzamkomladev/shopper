import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shopper/ui/components/tabs";
import type { CustomerView } from "../../../queries/customers/types";
import { PointsPanel } from "../points/panel";
import { PurchasesPanel } from "../purchases/panel";
import { StatementPanel } from "../statement/panel";

type Tab = "purchases" | "statement" | "points";

const TABS = [
  { value: "purchases", search: undefined, label: "Purchases" },
  { value: "statement", search: "statement", label: "Statement" },
  { value: "points", search: "points", label: "Points history" },
] as const;

type Props = {
  customer: CustomerView;
  /** The chosen tab; Purchases when the address names none. */
  tab: "statement" | "points" | undefined;
  canManage: boolean;
};

/** What they bought, their statement and their points, one at a time; the tab is in the address so a link opens it. */
export function CustomerTabs({ customer, tab, canManage }: Props) {
  const active: Tab = tab ?? "purchases";
  return (
    <Tabs value={active} activationMode="manual" className="gap-6">
      <TabsList aria-label="Customer history" className="max-w-full justify-start overflow-x-auto">
        {TABS.map(({ value, search, label }) => (
          <TabsTrigger key={value} value={value} asChild className="px-3 sm:px-4">
            <Link
              to="/customers/$customerId"
              params={{ customerId: customer.id }}
              search={{ tab: search }}
              replace
            >
              {label}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={active} className="flex flex-col gap-6">
        {active === "purchases" && <PurchasesPanel customerId={customer.id} name={customer.name} />}
        {active === "statement" && <StatementPanel customer={customer} canManage={canManage} />}
        {active === "points" && <PointsPanel customerId={customer.id} />}
      </TabsContent>
    </Tabs>
  );
}
