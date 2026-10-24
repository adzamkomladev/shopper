import { useSuspenseQuery } from "@tanstack/react-query";
import { StatementsForm } from "../../../components/settings/statements/form";
import { SettingsPage } from "../../../components/settings/page";
import { settingsQuery } from "../../../queries/settings/resource";

/** Whether customers with a balance get a statement every month, and how it reaches them. */
export function StatementsSettingsScreen() {
  const { data } = useSuspenseQuery(settingsQuery("statements"));
  return (
    <SettingsPage
      title="Statements"
      description="Send each customer who owes money their statement on the same day every month."
    >
      <StatementsForm settings={data} />
    </SettingsPage>
  );
}
