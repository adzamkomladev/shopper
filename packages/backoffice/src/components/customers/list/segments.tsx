import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shopper/ui/components/tabs";
import type { CustomersSearch } from "../../../queries/customers/types";

const SEGMENTS = [
  { segment: undefined, label: "All" },
  { segment: "account", label: "On account" },
  { segment: "business", label: "Business" },
  { segment: "archived", label: "Archived" },
] as const;

type Props = {
  segment: CustomersSearch["segment"];
  q: string | undefined;
  /** The customers of the chosen segment: its panel. */
  children: React.ReactNode;
};

/** All active customers, only those who owe, only businesses, or the archived ones; the search carries across. */
export function Segments({ segment, q, children }: Props) {
  return (
    <Tabs value={segment ?? "all"} activationMode="manual" className="min-h-0 flex-1 gap-6">
      <TabsList variant="line" aria-label="Which customers">
        {SEGMENTS.map((entry) => (
          <TabsTrigger key={entry.label} value={entry.segment ?? "all"} asChild>
            <Link to="/customers" search={{ q, segment: entry.segment }} replace>
              {entry.label}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={segment ?? "all"} className="flex min-h-0 flex-1 flex-col gap-6">
        {children}
      </TabsContent>
    </Tabs>
  );
}
