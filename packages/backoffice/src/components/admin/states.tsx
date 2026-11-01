import type { LucideIcon } from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@shopper/ui/components/empty";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { DataTableSkeleton } from "@shopper/ui/components/table/skeleton";
import type { DataTableSkeletonColumn } from "@shopper/ui/components/table/skeleton";

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
        <h2 className="text-base font-medium tracking-tight">{title}</h2>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children && (
        <EmptyContent className="flex-row flex-wrap justify-center">{children}</EmptyContent>
      )}
    </Empty>
  );
}

/** One block per text line of a loaded cell: `h-5` for body text, `h-4` for the small line under it. */
export function CellLines({ lines }: { lines: string[] }) {
  return (
    <div className="flex flex-col">
      {lines.map((line, index) => (
        <Skeleton key={index} className={line} />
      ))}
    </div>
  );
}

const ACTIONS = { header: "", cell: <Skeleton className="ml-auto h-7 w-24" /> };
const text = (width: string) => <Skeleton className={`h-5 ${width}`} />;

// Each list's columns as its `DataTable` declares them, and what sits between the heading row and the table.
const LISTS = {
  stores: {
    label: "Loading stores",
    columns: [
      { header: "Store", cell: text("w-40") },
      {
        header: "Cash rounding",
        className: "text-right",
        cell: <Skeleton className="ml-auto h-5 w-16" />,
      },
      ACTIONS,
    ],
  },
  branches: {
    label: "Loading branches",
    columns: [
      { header: "Branch", cell: text("w-40") },
      { header: "Store", cell: text("w-32") },
      ACTIONS,
    ],
  },
  roles: {
    label: "Loading roles",
    columns: [
      { header: "Role", cell: text("w-32") },
      { header: "Permissions", cell: text("w-16") },
      { header: "Members", cell: text("w-20") },
      ACTIONS,
    ],
  },
  devices: {
    label: "Loading devices",
    columns: [
      { header: "Device", cell: text("w-32") },
      { header: "Branch", cell: text("w-28") },
      { header: "Status", cell: text("w-16") },
      { header: "Added", cell: text("w-24") },
      ACTIONS,
    ],
  },
  layouts: {
    label: "Loading barcode layouts",
    note: true,
    columns: [
      { header: "Prefix", cell: text("w-8") },
      { header: "Label", cell: text("w-24") },
      { header: "Product code", cell: text("w-24") },
      { header: "Value", cell: text("w-24") },
      ACTIONS,
    ],
  },
} satisfies Record<string, { label: string; note?: boolean; columns: DataTableSkeletonColumn[] }>;

const LIST_ROWS = 5;

/** The heading row and table of an administration list, as `PageHeader` and `DataTable` draw them. */
export function ListSkeleton({ list }: { list: keyof typeof LISTS }) {
  const { label, columns, ...extra } = LISTS[list];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-28" />
      </div>
      {"note" in extra && (
        <div className="flex max-w-2xl flex-col" aria-hidden>
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
        </div>
      )}
      <DataTableSkeleton label={label} columns={columns} rows={LIST_ROWS} />
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
