import { usePermissions } from "../../session/permissions";
import { NAV_ITEMS } from "./nav-items";

/** The links this member may use. Gated links wait for the permission list rather than flash and vanish. */
export function useNavItems() {
  const granted = usePermissions();
  return NAV_ITEMS.filter(({ permission }) => !permission || granted?.includes(permission));
}
