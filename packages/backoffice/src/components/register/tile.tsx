import type { LucideIcon } from "lucide-react";
import { Card } from "@shopper/ui/components/card";
import { Skeleton } from "@shopper/ui/components/skeleton";

/** Figma "Tile": a label with its icon, the figure and a one-line caption. */
export function Tile({
  label,
  icon: Icon,
  value,
  caption,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  caption: string;
}) {
  return (
    <Card className="min-w-0 gap-3 rounded-2xl py-6 shadow-none">
      <div className="flex items-center justify-between gap-4 px-6">
        <h2 className="text-sm font-medium">{label}</h2>
        <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1 px-6">
        <p className="truncate text-2xl leading-none font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        <p className="truncate py-0.5 text-xs text-muted-foreground">{caption}</p>
      </div>
    </Card>
  );
}

/** A tile's own card with blocks the size of its label, figure and caption, so it is as tall as a loaded one. */
export function TileSkeleton() {
  return (
    <Card className="min-w-0 gap-3 rounded-2xl py-6 shadow-none">
      <div className="flex items-center justify-between gap-4 px-6">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="size-4 shrink-0" />
      </div>
      <div className="flex flex-col gap-1 px-6">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-5 w-40 max-w-full" />
      </div>
    </Card>
  );
}
