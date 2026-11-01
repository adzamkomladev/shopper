import * as React from "react";
import { cn } from "cn";
import { PanelLeftIcon } from "lucide-react";
import { Slot } from "radix-ui";
import { Button } from "#components/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "#components/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "#components/tooltip";
import { useSidebar } from "./provider";

/** The sidebar column: a full-height rail that expands to labels, or a left sheet below md. */
export function Sidebar({ label, children }: { label: string; children: React.ReactNode }) {
  const sidebar = useSidebar();
  if (sidebar.mobile)
    return (
      <Sheet open={sidebar.openMobile} onOpenChange={sidebar.setOpenMobile}>
        <SheetContent
          side="left"
          showCloseButton={false}
          aria-label={label}
          className="w-72 gap-0 bg-card p-0"
        >
          <SheetTitle className="sr-only">{label}</SheetTitle>
          <SheetDescription className="sr-only">Pages and your account</SheetDescription>
          <nav aria-label={label} className="flex min-h-0 flex-1 flex-col">
            {children}
          </nav>
        </SheetContent>
      </Sheet>
    );
  return (
    <nav
      aria-label={label}
      className={cn(
        "flex h-full w-60 shrink-0 flex-col border-r bg-card transition-[width] duration-200 ease-out",
        // A touch rail keeps its buttons 44px wide.
        sidebar.touch
          ? "group-data-[sidebar=collapsed]/sidebar:w-16"
          : "group-data-[sidebar=collapsed]/sidebar:w-12",
      )}
    >
      {children}
    </nav>
  );
}

export function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2 p-2", className)} {...props} />;
}

export function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-auto flex flex-col gap-2 border-t p-2", className)} {...props} />;
}

/** The scrolling middle of the sidebar, where the groups go. */
export function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto p-2",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  const id = React.useId();
  return (
    <div role="group" aria-labelledby={label ? id : undefined} className="flex flex-col gap-0.5">
      {label && (
        <p
          id={id}
          className="flex h-7 items-center px-2 text-xs font-medium text-muted-foreground transition-opacity duration-200 group-data-[sidebar=collapsed]/sidebar:sr-only"
        >
          {label}
        </p>
      )}
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </div>
  );
}

const itemClass = cn(
  "relative flex h-8 w-full min-w-0 items-center gap-2 group-data-[sidebar=collapsed]/sidebar:justify-center overflow-hidden rounded-md px-2 text-left text-sm text-muted-foreground outline-none transition-colors duration-150",
  "hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
  "data-[active=true]:bg-accent data-[active=true]:font-medium data-[active=true]:text-foreground",
  // The active indicator grows in on the left edge.
  "before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:scale-y-0 before:rounded-full before:bg-primary before:transition-transform before:duration-200 data-[active=true]:before:scale-y-100",
  "[&>span]:truncate [&>span]:transition-opacity group-data-[sidebar=collapsed]/sidebar:[&>span]:sr-only [&>svg]:size-4 [&>svg]:shrink-0",
);

/**
 * One row: renders as its child (`asChild`, e.g. a router Link) or a button. In the icon rail the label
 * hides and a tooltip names it, with its shortcut.
 */
export function SidebarMenuButton({
  asChild,
  active,
  tooltip,
  shortcut,
  className,
  onClick,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean;
  active?: boolean;
  tooltip: string;
  shortcut?: string;
}) {
  const sidebar = useSidebar();
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Comp
          data-active={active}
          aria-current={active ? "page" : undefined}
          aria-keyshortcuts={shortcut}
          className={cn(itemClass, sidebar.touch && "h-11", className)}
          onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
            onClick?.(event);
            if (sidebar.mobile) sidebar.setOpenMobile(false);
          }}
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent side="right" hidden={sidebar.open || sidebar.mobile}>
        {tooltip}
        {shortcut && <span className="ml-2 opacity-70">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

/** The header button that expands and collapses the sidebar (Mod+B), or opens the sheet on a phone. */
export function SidebarTrigger({ className }: { className?: string }) {
  const sidebar = useSidebar();
  const label = sidebar.mobile ? "Open navigation" : "Toggle sidebar";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-expanded={sidebar.mobile ? sidebar.openMobile : sidebar.open}
          aria-keyshortcuts="Control+B Meta+B"
          className={cn(sidebar.touch && "size-11", className)}
          onClick={sidebar.toggle}
        >
          <PanelLeftIcon aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        <span className="ml-2 opacity-70">Ctrl+B</span>
      </TooltipContent>
    </Tooltip>
  );
}

/** The page column beside the sidebar. */
export function SidebarInset({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)} {...props} />;
}
