import { useSuspenseQuery } from "@tanstack/react-query";
import { CreditForm } from "../../../components/settings/credit/form";
import { SettingsPage } from "../../../components/settings/page";
import { SETTINGS_COPY } from "../../../components/settings/states";
import { settingsQuery } from "../../../queries/settings/resource";

/** How long customers have to pay on account, and the monthly interest on what is overdue. */
export function CreditSettingsScreen() {
  const { data } = useSuspenseQuery(settingsQuery("credit"));
  return (
    <SettingsPage {...SETTINGS_COPY.credit}>
      <CreditForm settings={data} />
    </SettingsPage>
  );
}
