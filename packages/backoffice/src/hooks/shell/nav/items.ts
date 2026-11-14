import { createElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import type { SidebarNavGroup, SidebarNavItem } from "@shopper/ui/components/sidebar/nav";
import { billingStatusQuery } from "../../../queries/billing";
import { usePermissions } from "../../../queries/session/permissions";
import { holds } from "../../../lib/roles/permissions";
import { NAV_ITEMS, NAV_SECTIONS } from "../../../lib/shell/nav/items";

/** The links this member may use. Gated links wait for the permission list rather than flash and vanish. */
export function useNavItems() {
  const granted = usePermissions();
  const onBox = !!useQuery(billingStatusQuery()).data?.licence;
  return NAV_ITEMS.filter(
    (item) => (!item.permission || holds(granted, item.permission)) && (!item.box || onBox),
  );
}

/** The member's pages as sidebar groups: one-page sections as links, larger ones as collapsible parents. */
export function useSidebarGroups(): SidebarNavGroup[] {
  const items = useNavItems().filter((item) => !item.account);
  const path = useRouterState({ select: (state) => state.location.pathname });
  const link = (item: (typeof items)[number]): SidebarNavItem => ({
    label: item.label,
    icon: item.icon,
    active: [item.to, ...(item.also ?? [])].some(
      (page) => path === page || path.startsWith(`${page}/`),
    ),
    render: createElement(Link, { to: item.to }),
  });
  const groups = [...new Set(NAV_SECTIONS.map((section) => section.group))];
  return groups.map((group) => ({
    label: group,
    items: NAV_SECTIONS.filter((section) => section.group === group).flatMap((section) => {
      const pages = items.filter((item) => item.section === section.name).map(link);
      if (pages.length < 2) return pages;
      return [{ label: section.name, icon: section.icon, items: pages }];
    }),
  }));
}
