import { Link, useNavigate } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shopper/ui/components/tabs";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { Gate } from "../register/states";
import { focusIfIdle } from "../../lib/focus";
import { ReportSkeleton } from "./states";

type ReportTab = "dashboard" | "sales" | "products" | "stock" | "branches" | "journal";

const TABS = [
  { value: "dashboard", to: "/reports", label: "Dashboard" },
  { value: "sales", to: "/reports/sales", label: "Sales" },
  { value: "products", to: "/reports/products", label: "Products" },
  { value: "stock", to: "/reports/stock/dead", label: "Dead stock" },
  { value: "branches", to: "/reports/branches", label: "Branches" },
  { value: "journal", to: "/reports/journal", label: "Journal" },
] as const;

/** The reports area: heading and the six report tabs, which keys 1–6 open. Every report needs report.read. */
export function ReportsPage({
  active,
  children,
}: {
  active: ReportTab;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const shortcuts = useShortcuts(
    Object.fromEntries(
      TABS.map((tab, index) => [String(index + 1), () => void navigate({ to: tab.to })]),
    ),
  );
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
      {/* Focused on arrival, so the screen's shortcuts work straight after navigating here. */}
      <h1
        tabIndex={-1}
        ref={focusIfIdle}
        className="text-3xl font-bold tracking-tight outline-none"
      >
        Reports
      </h1>
      <Tabs value={active} activationMode="manual" className="min-h-0 flex-1 gap-6">
        <TabsList aria-label="Reports" className="max-w-full justify-start overflow-x-auto">
          {TABS.map(({ value, to, label }, index) => (
            <TabsTrigger key={value} value={value} asChild className="px-3 sm:px-4">
              <Link to={to} aria-keyshortcuts={String(index + 1)}>
                {label}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={active} className="flex min-h-0 flex-1 flex-col gap-6">
          <Gate
            need="report.read"
            what="reports"
            fallback={<ReportSkeleton label="Loading reports" />}
          >
            {children}
          </Gate>
        </TabsContent>
      </Tabs>
    </div>
  );
}
