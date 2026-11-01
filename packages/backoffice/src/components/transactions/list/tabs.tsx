import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from "@shopper/ui/components/tabs";
import type { TransactionSearch } from "../../../schemas/transactions";

type Status = NonNullable<TransactionSearch["status"]>;
type Counts = Record<Status, number>;

const TABS: { value: Status; label: string }[] = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "refunded", label: "Refunded" },
  { value: "pending", label: "Pending MoMo" },
];

/** The status tabs, each with how many transactions the search and range hold in it. */
export function StatusTabs({
  search,
  counts,
  children,
}: {
  search: TransactionSearch;
  counts?: Counts;
  /** The transactions of the chosen status: the tab's panel. */
  children: React.ReactNode;
}) {
  const active = search.status ?? "all";
  return (
    <Tabs value={active} activationMode="manual" className="min-h-0 flex-1 gap-6">
      <TabsList variant="line" aria-label="Status">
        {TABS.map(({ value, label }) => (
          <TabsTrigger key={value} value={value} asChild>
            <Link
              to="/transactions"
              search={{ ...search, status: value === "all" ? undefined : value }}
              replace
            >
              {label}
              <TabsCount>{counts?.[value] ?? "–"}</TabsCount>
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={active} className="flex min-h-0 flex-1 flex-col gap-6">
        {children}
      </TabsContent>
    </Tabs>
  );
}
