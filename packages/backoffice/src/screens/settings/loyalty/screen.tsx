import { useSuspenseQuery } from "@tanstack/react-query";
import { CustomersPage } from "../../../components/customers/tabs";
import { LoyaltyForm } from "../../../components/settings/loyalty/form";
import { TierSection } from "../../../components/settings/loyalty/tiers/section";
import { SettingsPage } from "../../../components/settings/page";
import { SETTINGS_COPY } from "../../../components/settings/states";
import { settingsQuery } from "../../../queries/settings/resource";
import { tiersQuery } from "../../../queries/settings/tiers";

/** The org's loyalty rules, and the tiers that change the rate a customer earns at. */
export function LoyaltySettingsScreen() {
  const { data: settings } = useSuspenseQuery(settingsQuery("loyalty"));
  const { data: tiers } = useSuspenseQuery(tiersQuery());
  return (
    <CustomersPage active="loyalty" title="Loyalty">
      <SettingsPage description={SETTINGS_COPY.loyalty.description}>
        <LoyaltyForm settings={settings} />
        <TierSection tiers={tiers.items} />
      </SettingsPage>
    </CustomersPage>
  );
}
