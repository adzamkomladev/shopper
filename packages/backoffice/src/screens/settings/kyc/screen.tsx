import { useSuspenseQuery } from "@tanstack/react-query";
import { KycSettingsForm } from "../../../components/settings/kyc/form";
import { SettingsPage } from "../../../components/settings/page";
import { settingsQuery } from "../../../queries/settings/resource";

/** Whether a credit check needs an ID document, and which kinds of ID are accepted. */
export function KycSettingsScreen() {
  const { data } = useSuspenseQuery(settingsQuery("kyc"));
  return (
    <SettingsPage
      title="Identity check settings"
      description="What a person must show before a customer gets credit or a staff member gets a role."
    >
      <KycSettingsForm settings={data} />
    </SettingsPage>
  );
}
