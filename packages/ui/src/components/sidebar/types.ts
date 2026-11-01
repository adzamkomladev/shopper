import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";

export type SidebarState = {
  /** Expanded (true) or the icon rail (false), saved per app. */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Below md the sidebar is a sheet instead. */
  mobile: boolean;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  toggle: () => void;
  /** A touch screen (the till): rows and the toggle grow to 44 px targets. */
  touch: boolean;
};

export type SidebarNavItem = {
  label: string;
  icon: LucideIcon;
  /** The element the item renders as, such as a router Link or a button; the icon and label go inside. */
  render?: ReactElement;
  active?: boolean;
  /** Shown in the tooltip and set as aria-keyshortcuts, such as "Alt+P". */
  shortcut?: string;
  /** Sub-items under a collapsible parent; the parent opens when one of them is active. */
  items?: readonly SidebarNavItem[];
};

export type SidebarNavGroup = { label?: string; items: readonly SidebarNavItem[] };
