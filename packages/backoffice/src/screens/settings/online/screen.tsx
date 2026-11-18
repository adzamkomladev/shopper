import { useSuspenseQuery } from "@tanstack/react-query";
import { OnlineCategories } from "../../../components/settings/online/categories";
import { OnlineOrdersCard } from "../../../components/settings/online/orders";
import { SettingsPage } from "../../../components/settings/page";
import { SETTINGS_COPY } from "../../../components/settings/states";
import { categoriesQuery } from "../../../queries/catalogue/list";
import { onlineSettingsQuery } from "../../../queries/settings/online";

/** What the online store shows: on a box, whether it sells online at all; everywhere, which categories are listed. */
export function OnlineSettingsScreen() {
  const settings = useSuspenseQuery(onlineSettingsQuery()).data;
  const categories = useSuspenseQuery(categoriesQuery()).data;
  return (
    <SettingsPage {...SETTINGS_COPY.online}>
      {settings.box && <OnlineOrdersCard settings={settings} />}
      <OnlineCategories categories={categories} />
    </SettingsPage>
  );
}
