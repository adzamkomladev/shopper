import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shopper/ui/components/tabs";
import { FISCAL_SEGMENTS } from "../../../lib/tax/fiscal";
import type { FiscalSearch, FiscalSegment } from "../../../schemas/tax/fiscal";

type Props = {
  active: FiscalSegment;
  counts: Record<FiscalSegment, number>;
  /** The rest of the address (search and archive day), kept when the segment changes. */
  search: FiscalSearch;
  children: React.ReactNode;
};

/** All, Pending, Accepted, Rejected and Dead-lettered, each with its count (Figma 45:852). Keys 1 to 5. */
export function FiscalSegments({ active, counts, search, children }: Props) {
  return (
    <Tabs value={active} activationMode="manual" className="min-h-80 flex-1 gap-4">
      <TabsList
        variant="line"
        aria-label="Fiscal document status"
        className="w-full justify-start overflow-x-auto max-sm:gap-0"
      >
        {FISCAL_SEGMENTS.map(({ value, label }, index) => (
          <TabsTrigger
            key={value}
            value={value}
            asChild
            className="flex-none px-2 max-sm:text-xs sm:px-3"
          >
            <Link
              to="/tax/fiscal"
              search={{ ...search, status: value }}
              replace
              aria-keyshortcuts={String(index + 1)}
            >
              {label}{" "}
              <span className="text-xs text-muted-foreground tabular-nums">{counts[value]}</span>
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={active} className="flex min-h-0 flex-1 flex-col gap-4">
        {children}
      </TabsContent>
    </Tabs>
  );
}
