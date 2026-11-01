import { useSuspenseQuery } from "@tanstack/react-query";
import { KycSettingsForm } from "../../../components/settings/kyc/form";
import { SettingsPage } from "../../../components/settings/page";
import { SETTINGS_COPY } from "../../../components/settings/states";
import { settingsQuery } from "../../../queries/settings/resource";

/** Whether a credit check needs an ID document, and which kinds of ID are accepted. */
export function KycSettingsScreen() {
  const { data } = useSuspenseQuery(settingsQuery("kyc"));
  return (
    <SettingsPage {...SETTINGS_COPY.kyc}>
      <KycSettingsForm settings={data} />
    </SettingsPage>
  );
}
