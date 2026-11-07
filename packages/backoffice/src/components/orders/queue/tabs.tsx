import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from "@shopper/ui/components/tabs";
import { STAGES, type OrderSearch, type Stage } from "../../../schemas/orders";

const LABELS: Record<Stage, string> = {
  new: "New",
  preparing: "Preparing",
  ready: "Ready",
  done: "Done",
};

/** The stages of the queue, each with how many orders it holds. */
export function StageTabs({
  search,
  counts,
  children,
}: {
  search: OrderSearch;
  counts?: Record<Stage, number>;
  /** The orders of the chosen stage: the tab's panel. */
  children: React.ReactNode;
}) {
  const active = search.stage ?? "new";
  return (
    <Tabs value={active} activationMode="manual" className="min-h-0 flex-1 gap-6">
      <TabsList variant="line" aria-label="Stage">
        {STAGES.map((stage) => (
          <TabsTrigger key={stage} value={stage} asChild>
            <Link
              to="/orders"
              search={{ ...search, stage: stage === "new" ? undefined : stage }}
              replace
            >
              {LABELS[stage]}
              <TabsCount>{counts?.[stage] ?? "–"}</TabsCount>
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
