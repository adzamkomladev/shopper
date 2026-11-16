import { useParams, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { TenantActivity } from "../../../components/tenants/detail/activity";
import { TenantBilling } from "../../../components/tenants/detail/billing";
import { TenantHeader } from "../../../components/tenants/detail/header";
import { TenantOverview } from "../../../components/tenants/detail/overview";
import { TenantProducts } from "../../../components/tenants/detail/products";
import { TenantStaff } from "../../../components/tenants/detail/staff";
import { TenantStores } from "../../../components/tenants/detail/stores";
import { TenantTabs } from "../../../components/tenants/detail/tabs";
import { TenantVerification } from "../../../components/tenants/detail/verification";
import { tenantQuery } from "../../../queries/platform";
import type { TenantTab } from "../../../schemas/types";

/** One shop's full picture for staff debugging it, a tab per part, the tab kept in the address. */
export function TenantScreen() {
  const { orgId } = useParams({ from: "/_staff/tenants/$orgId" });
  const tab: TenantTab = useSearch({ from: "/_staff/tenants/$orgId" }).tab;
  const { data } = useSuspenseQuery(tenantQuery(orgId));
  const panels = {
    overview: () => <TenantOverview shop={data.overview} />,
    stores: () => <TenantStores stores={data.stores} />,
    products: () => <TenantProducts products={data.products} />,
    staff: () => <TenantStaff staff={data.staff} />,
    verification: () => <TenantVerification orgId={orgId} verification={data.verification} />,
    billing: () => <TenantBilling billing={data.billing} />,
    activity: () => <TenantActivity activity={data.activity} />,
  };
  return (
    <div className="flex max-w-5xl flex-col gap-6 pb-6">
      <TenantHeader shop={data.overview} />
      <TenantTabs orgId={orgId} active={tab}>
        {panels[tab]()}
      </TenantTabs>
    </div>
  );
}
