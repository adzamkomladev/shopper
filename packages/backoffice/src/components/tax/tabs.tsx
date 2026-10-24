import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shopper/ui/components/tabs";
import { focusIfIdle } from "../../lib/focus";

type TaxTab = "summary" | "returns" | "rules" | "settings";

const TABS: {
  value: TaxTab;
  to: "/tax" | "/tax/returns" | "/tax/rules" | "/tax/settings";
  label: string;
}[] = [
  { value: "summary", to: "/tax", label: "Summary" },
  { value: "returns", to: "/tax/returns", label: "VAT return" },
  { value: "rules", to: "/tax/rules", label: "Rates" },
  { value: "settings", to: "/tax/settings", label: "Settings" },
];

type Props = {
  active: TaxTab;
  /** The tab's primary button, at the end of the tab bar. */
  action?: React.ReactNode;
  children: React.ReactNode;
};

/** The tax area's heading and tab bar; every tab needs tax.read, so all four always show. */
export function TaxPage({ active, action, children }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {/* Focused on arrival, so the screen's shortcuts work straight after navigating here. */}
      <h1
        tabIndex={-1}
        ref={focusIfIdle}
        className="text-3xl font-bold tracking-tight outline-none"
      >
        Tax
      </h1>
      <Tabs value={active} activationMode="manual" className="min-h-0 flex-1 gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList aria-label="Tax" className="max-w-full justify-start overflow-x-auto">
            {TABS.map(({ value, to, label }) => (
              <TabsTrigger key={value} value={value} asChild className="px-3 sm:px-4">
                <Link to={to}>{label}</Link>
              </TabsTrigger>
            ))}
          </TabsList>
          {action}
        </div>
        <TabsContent value={active} className="flex min-h-0 flex-1 flex-col gap-6">
          {children}
        </TabsContent>
      </Tabs>
    </div>
  );
}
