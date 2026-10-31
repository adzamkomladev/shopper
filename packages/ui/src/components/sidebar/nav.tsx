import { cloneElement, useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "#components/collapsible";
import { SidebarGroup, SidebarMenuButton } from "./parts";
import { useSidebar } from "./provider";
import type { SidebarNavGroup, SidebarNavItem } from "./types";
export type { SidebarNavGroup, SidebarNavItem } from "./types";

/** Labelled groups of pages. A parent with sub-items collapses, and starts open when it holds the current page. */
export function SidebarNav({ groups }: { groups: readonly SidebarNavGroup[] }) {
  return groups
    .filter((group) => group.items.length > 0)
    .map((group, index) => (
      <SidebarGroup key={group.label ?? index} label={group.label}>
        {group.items.map((item) =>
          item.items ? (
            <ParentItem key={item.label} item={item} items={item.items} />
          ) : (
            <li key={item.label}>
              <ItemButton item={item} />
            </li>
          ),
        )}
      </SidebarGroup>
    ));
}

function ItemButton({ item }: { item: SidebarNavItem }) {
  return (
    <SidebarMenuButton
      asChild={Boolean(item.render)}
      active={item.active}
      tooltip={item.label}
      shortcut={item.shortcut}
    >
      {withContent(item)}
    </SidebarMenuButton>
  );
}

function ParentItem({ item, items }: { item: SidebarNavItem; items: readonly SidebarNavItem[] }) {
  const sidebar = useSidebar();
  const active = items.some((child) => child.active);
  const [open, setOpen] = useState(active);
  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <li className="group/parent">
        <CollapsibleTrigger asChild>
          {/* In the icon rail the sub-items have nowhere to show, so the parent expands the sidebar first. */}
          <SidebarMenuButton
            active={active && !sidebar.open}
            tooltip={item.label}
            onClick={(event) => {
              if (sidebar.open || sidebar.mobile) return;
              event.preventDefault();
              sidebar.setOpen(true);
              setOpen(true);
            }}
          >
            <item.icon aria-hidden />
            <span>{item.label}</span>
            <ChevronRightIcon
              aria-hidden
              className="ml-auto transition-transform duration-200 group-data-[state=open]/parent:rotate-90 group-data-[sidebar=collapsed]/sidebar:hidden"
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className="group-data-[sidebar=collapsed]/sidebar:hidden">
          <ul className="ml-4 flex flex-col gap-0.5 border-l py-0.5 pl-2">
            {items.map((child) => (
              <li key={child.label}>
                <ItemButton item={child} />
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}

function withContent(item: SidebarNavItem) {
  const content = (
    <>
      <item.icon aria-hidden />
      <span>{item.label}</span>
    </>
  );
  // The render element (a Link or button) keeps its own props and takes the icon and label as children.
  return item.render ? cloneElement(item.render, undefined, content) : content;
}
