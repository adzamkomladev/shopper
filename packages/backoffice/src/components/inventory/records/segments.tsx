import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shopper/ui/components/tabs";
import { KINDS } from "../../../lib/inventory/records";
import type { RecordsSearch } from "../../../queries/inventory/types";

type Counts = { count: number; receipt: number; adjustment: number };

type Props = {
  /** Unknown until the first page is in; the segments are there meanwhile, so a key press on one is never lost. */
  counts?: Counts;
  kind: RecordsSearch["kind"];
  branchId: string;
  /** The records of the chosen kind: the segment's panel. */
  children: React.ReactNode;
};

/** All records, or only received, adjusted or counted ones, each with how many there are (Figma 45:852). */
export function Segments({ counts, kind, branchId, children }: Props) {
  const segments = [
    {
      kind: undefined,
      label: "All",
      total: counts && counts.count + counts.receipt + counts.adjustment,
    },
    ...KINDS.map((entry) => ({
      kind: entry.kind,
      label: entry.label,
      total: counts?.[entry.api],
    })),
  ];
  return (
    <Tabs value={kind ?? "all"} activationMode="manual" className="min-h-0 flex-1 gap-6">
      <TabsList
        variant="line"
        aria-label="Kind of record"
        className="w-full justify-start max-sm:gap-0"
      >
        {segments.map((segment) => (
          <TabsTrigger
            key={segment.label}
            value={segment.kind ?? "all"}
            asChild
            className="flex-none px-2 max-sm:text-xs sm:px-3"
          >
            <Link
              to="/stock/records"
              search={{ branch: branchId, kind: segment.kind }}
              replace
              data-segment={segment.kind ?? "all"}
            >
              {segment.label}
              {segment.total !== undefined && (
                <>
                  {" "}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {segment.total}
                  </span>
                </>
              )}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={kind ?? "all"} className="flex min-h-0 flex-1 flex-col gap-6">
        {children}
      </TabsContent>
    </Tabs>
  );
}
