import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from "@shopper/ui/components/tabs";
import { SEGMENTS } from "../../../lib/kyc/status";
import type { Segment } from "../../../lib/kyc/types";

type Props = {
  active: Segment;
  /** How many checks each segment holds, so the tab says whether it is worth opening. */
  counts: Record<Segment, number>;
  /** The active segment's checks. */
  children: React.ReactNode;
};

/** Awaiting approval, Open and Closed: the queue's three views, each a link so the address keeps the view. */
export function Segments({ active, counts, children }: Props) {
  return (
    <Tabs value={active} activationMode="manual" className="min-h-0 flex-1 gap-6">
      <TabsList variant="line" aria-label="Identity check segments">
        {SEGMENTS.map(({ value, label }) => (
          <TabsTrigger key={value} value={value} asChild>
            <Link to="/kyc" search={{ segment: value }}>
              {label}
              <TabsCount>{counts[value]}</TabsCount>
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
