import { useSuspenseQuery } from "@tanstack/react-query";
import { Gate } from "../../../components/register/states";
import { TaxSettingsForm } from "../../../components/tax/settings/form";
import { TaxSettingsSummary } from "../../../components/tax/settings/view";
import { TaxBodySkeleton } from "../../../components/tax/states";
import { TaxPage } from "../../../components/tax/tabs";
import { settingsQuery } from "../../../queries/settings/resource";
import { usePermissions } from "../../../queries/session/permissions";

/** The business's TIN and VAT registration, its price mode and cash rounding. Changing them needs tax.write. */
export function TaxSettingsScreen() {
  return (
    <TaxPage active="settings">
      <Gate
        need="tax.read"
        what="the tax settings"
        fallback={<TaxBodySkeleton label="Loading tax settings" />}
      >
        <SettingsBody />
      </Gate>
    </TaxPage>
  );
}

function SettingsBody() {
  const { data } = useSuspenseQuery(settingsQuery("tax"));
  const canWrite = !!usePermissions()?.includes("tax.write");
  return (
    <div className="flex max-w-2xl flex-col gap-6 pb-6">
      <p className="text-sm text-muted-foreground">
        How every till charges tax. A change reaches the tills on their next sync; sales already
        made keep their tax.
      </p>
      {canWrite ? <TaxSettingsForm settings={data} /> : <TaxSettingsSummary settings={data} />}
    </div>
  );
}
