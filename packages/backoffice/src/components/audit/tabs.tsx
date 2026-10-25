import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shopper/ui/components/tabs";
import { focusIfIdle } from "../../lib/focus";

type AuditTab = "log" | "integrity";

const TABS: { value: AuditTab; to: "/audit" | "/audit/integrity"; label: string }[] = [
  { value: "log", to: "/audit", label: "Log" },
  { value: "integrity", to: "/audit/integrity", label: "Integrity" },
];

type Props = {
  active: AuditTab;
  /** The tab's primary button, at the end of the tab bar. */
  action?: React.ReactNode;
  children: React.ReactNode;
};

/** The audit area's heading and tab bar; both tabs need audit.read. */
export function AuditPage({ active, action, children }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {/* Focused on arrival, so the screen's shortcuts work straight after navigating here. */}
      <h1
        tabIndex={-1}
        ref={focusIfIdle}
        className="text-3xl font-bold tracking-tight outline-none"
      >
        Audit
      </h1>
      <Tabs value={active} activationMode="manual" className="min-h-0 flex-1 gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList aria-label="Audit" className="max-w-full justify-start overflow-x-auto">
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
