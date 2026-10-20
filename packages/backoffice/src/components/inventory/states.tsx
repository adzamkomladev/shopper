import { Skeleton } from "@shopper/ui/components/skeleton";

/** Heading and tab bar as they load, with the tab's own skeleton below; `action` reserves the button's place. */
export function InventorySkeleton({
  action,
  children,
}: {
  action?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-36" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-48" />
        {action && <Skeleton className="h-9 w-36" />}
      </div>
      {children}
    </div>
  );
}
