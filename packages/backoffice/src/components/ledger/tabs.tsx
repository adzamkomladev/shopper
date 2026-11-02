import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shopper/ui/components/tabs";
import { focusIfIdle } from "../../lib/focus";

type LedgerTab = "accounts" | "journal" | "statements";

const TABS: {
  value: LedgerTab;
  to: "/ledger" | "/ledger/journal" | "/ledger/statements";
  label: string;
}[] = [
  { value: "accounts", to: "/ledger", label: "Accounts" },
  { value: "journal", to: "/ledger/journal", label: "Journal" },
  { value: "statements", to: "/ledger/statements", label: "Statements" },
];

type Props = {
  active: LedgerTab;
  /** The tab's own controls, at the end of the tab bar. */
  action?: React.ReactNode;
  children: React.ReactNode;
};

/** The books' heading and tab bar; every tab needs ledger.read, so all three always show. */
export function LedgerPage({ active, action, children }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <h1
        tabIndex={-1}
        ref={focusIfIdle}
        className="text-2xl font-semibold tracking-tight outline-none"
      >
        Books
      </h1>
      <Tabs value={active} activationMode="manual" className="min-h-0 flex-1 gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList aria-label="Books">
            {TABS.map(({ value, to, label }) => (
              <TabsTrigger key={value} value={value} asChild>
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
