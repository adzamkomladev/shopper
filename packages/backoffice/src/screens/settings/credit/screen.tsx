import { useSuspenseQuery } from "@tanstack/react-query";
import { CreditForm } from "../../../components/settings/credit/form";
import { SettingsPage } from "../../../components/settings/page";
import { settingsQuery } from "../../../queries/settings/resource";

/** How long customers have to pay on account, and the monthly interest on what is overdue. */
export function CreditSettingsScreen() {
  const { data } = useSuspenseQuery(settingsQuery("credit"));
  return (
    <SettingsPage
      title="Credit"
      description="When a customer's balance is overdue and what it costs them. These rules apply to every customer account."
    >
      <CreditForm settings={data} />
    </SettingsPage>
  );
}
