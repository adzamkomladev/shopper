import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shopper/ui/components/tabs";
import type { UsersSearch } from "../../../schemas/users";

type Props = {
  status: UsersSearch["status"];
  counts: { active: number; deactivated: number };
  /** The members of the chosen status: the tab's panel. */
  children: React.ReactNode;
};

/** Active or deactivated members, each with how many there are (Figma 45:852). */
export function StatusTabs({ status, counts, children }: Props) {
  const value = status ?? "active";
  const tabs = [
    { status: undefined, value: "active", label: "Active", total: counts.active },
    {
      status: "deactivated" as const,
      value: "deactivated",
      label: "Deactivated",
      total: counts.deactivated,
    },
  ];
  return (
    <Tabs value={value} activationMode="manual" className="gap-3">
      <TabsList variant="line" aria-label="Member status" className="w-full justify-start">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} asChild className="flex-none px-3">
            <Link to="/users" search={{ status: tab.status }} replace>
              {tab.label}{" "}
              <span className="text-xs text-muted-foreground tabular-nums">{tab.total}</span>
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={value}>{children}</TabsContent>
    </Tabs>
  );
}
