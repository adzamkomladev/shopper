import { useSuspenseQuery } from "@tanstack/react-query";
import { NoTenants } from "../../../components/tenants/list/states";
import { TenantsTable } from "../../../components/tenants/list/table";
import { tenantsQuery } from "../../../queries/platform";

/** Every shop on Shopper, newest first: how far it got in onboarding, and its verification. */
export function TenantsScreen() {
  const { data } = useSuspenseQuery(tenantsQuery());
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Shops</h1>
        <span className="text-sm text-muted-foreground tabular-nums">{data.length}</span>
      </div>
      {data.length === 0 ? <NoTenants /> : <TenantsTable tenants={data} />}
    </div>
  );
}
