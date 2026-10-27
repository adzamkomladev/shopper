import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shopper/ui/components/tabs";
import { focusIfIdle } from "../../lib/focus";

type PaymentsTab = "reconciliation" | "settings";

const TABS: {
  value: PaymentsTab;
  to: "/payments/reconciliation" | "/payments/settings";
  label: string;
}[] = [
  { value: "reconciliation", to: "/payments/reconciliation", label: "Reconciliation" },
  { value: "settings", to: "/payments/settings", label: "Settings" },
];

type Props = {
  active: PaymentsTab;
  /** The tab's primary button, at the end of the tab bar. */
  action?: React.ReactNode;
  children: React.ReactNode;
};

/** The payments area's heading and tab bar: the day's reconciliation and how MoMo is collected. */
export function PaymentsPage({ active, action, children }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <h1
        tabIndex={-1}
        ref={focusIfIdle}
        className="text-3xl font-bold tracking-tight outline-none"
      >
        Payments
      </h1>
      <Tabs value={active} activationMode="manual" className="min-h-0 flex-1 gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList aria-label="Payments" className="max-w-full justify-start overflow-x-auto">
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
