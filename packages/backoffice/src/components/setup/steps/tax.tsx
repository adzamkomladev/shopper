import { useSuspenseQuery } from "@tanstack/react-query";
import { settingsQuery } from "../../../queries/settings/resource";
import { useRefreshSetup } from "../../../queries/setup";
import { TaxSettingsForm } from "../../tax/settings/form";

/** The tax settings form itself; tills pick a change up on their next sync. */
export function TaxStep() {
  const { data } = useSuspenseQuery(settingsQuery("tax"));
  const refresh = useRefreshSetup();
  return (
    <div className="max-w-2xl">
      <TaxSettingsForm settings={data} onSaved={refresh} />
    </div>
  );
}
