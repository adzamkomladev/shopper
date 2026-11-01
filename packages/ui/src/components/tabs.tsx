import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Tabs as TabsPrimitive } from "radix-ui";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn("group/tabs flex gap-2 data-[orientation=horizontal]:flex-col", className)}
      {...props}
    />
  );
}

/**
 * Two looks, one rule: `default` is the segmented pill for a page's own areas (Customers, Ageing,
 * Loyalty); `line` underlines the active filter inside a page (All, Completed, Refunded). Both scroll
 * sideways on a narrow screen without showing a scrollbar.
 */
const tabsListVariants = cva(
  "group/tabs-list no-scrollbar inline-flex max-w-full items-center justify-start overflow-x-auto overflow-y-hidden text-muted-foreground group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "w-fit rounded-lg bg-muted h-8 p-[3px]",
        line: "w-full gap-4 rounded-none border-b h-9 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-full shrink-0 items-center justify-center gap-1.5 border border-transparent text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-150 group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // Pill: the active tab is a raised chip.
        "group-data-[variant=default]/tabs-list:rounded-md group-data-[variant=default]/tabs-list:px-3 group-data-[variant=default]/tabs-list:data-[state=active]:bg-background group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm dark:group-data-[variant=default]/tabs-list:data-[state=active]:border-input dark:group-data-[variant=default]/tabs-list:data-[state=active]:bg-input/30",
        // Line: a 2px bar on the list's rule marks the active filter.
        "group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:px-1",
        "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 after:transition-opacity group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

/** A tab's count, quieter than its label. */
function TabsCount({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="tabs-count"
      className={cn("text-xs text-muted-foreground tabular-nums", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, TabsCount, tabsListVariants };
