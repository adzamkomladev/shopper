import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shopper/ui/components/tabs";
import { QUEUE_TABS, STATUS_LABELS } from "../../../lib/kyb/status";
import type { QueueTab } from "../../../schemas/types";

/** One tab per status a reviewer works through, each a link so the address keeps it. */
export function QueueTabs({ active, children }: { active: QueueTab; children: React.ReactNode }) {
  return (
    <Tabs value={active} activationMode="manual" className="min-h-0 flex-1 gap-6">
      <TabsList
        aria-label="Verification status"
        className="max-w-full justify-start overflow-x-auto"
      >
        {QUEUE_TABS.map((status) => (
          <TabsTrigger key={status} value={status} asChild className="px-3 sm:px-4">
            <Link to="/kyb" search={{ status }}>
              {STATUS_LABELS[status]}
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
