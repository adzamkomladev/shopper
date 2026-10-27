import { usePermissions } from "../../../queries/session/permissions";
import { holds } from "../../../lib/roles/permissions";
import { NAV_ITEMS } from "../../../lib/shell/nav/items";

/** The links this member may use. Gated links wait for the permission list rather than flash and vanish. */
export function useNavItems() {
  const granted = usePermissions();
  return NAV_ITEMS.filter(({ permission }) => !permission || holds(granted, permission));
}
