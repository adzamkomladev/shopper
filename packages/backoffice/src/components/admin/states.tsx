import type { LucideIcon } from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@shopper/ui/components/empty";
import { Skeleton } from "@shopper/ui/components/skeleton";

const SKELETON_ROWS = 5;

type EmptyProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
};

/** A list with nothing in it yet: what it is for, and the next action. */
export function EmptyList({ icon: Icon, title, description, children }: EmptyProps) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden />
        </EmptyMedia>
        <h2 className="text-lg font-medium tracking-tight">{title}</h2>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children && (
        <EmptyContent className="flex-row flex-wrap justify-center">{children}</EmptyContent>
      )}
    </Empty>
  );
}

/** Heading, button and rows in the shape of the loaded list, so nothing jumps when it arrives. */
export function ListSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true" aria-label={label}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="flex flex-col rounded-lg border">
        <Skeleton className="h-10 rounded-b-none" />
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <div key={index} className="flex h-16.5 items-center gap-6 border-t px-4">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="ml-auto h-8 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tells a member who can look but not change why the screen offers no buttons. */
export function ReadOnlyNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="note" className="text-sm text-muted-foreground">
      {children}
    </p>
  );
}
