import { useSuspenseQuery } from "@tanstack/react-query";
import { StatementsForm } from "../../../components/settings/statements/form";
import { SettingsPage } from "../../../components/settings/page";
import { SETTINGS_COPY } from "../../../components/settings/states";
import { settingsQuery } from "../../../queries/settings/resource";

/** Whether customers with a balance get a statement every month, and how it reaches them. */
export function StatementsSettingsScreen() {
  const { data } = useSuspenseQuery(settingsQuery("statements"));
  return (
    <SettingsPage {...SETTINGS_COPY.statements}>
      <StatementsForm settings={data} />
    </SettingsPage>
  );
}
