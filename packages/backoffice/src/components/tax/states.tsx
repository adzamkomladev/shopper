import { ReceiptTextIcon } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { usePermissions } from "../../queries/session/permissions";
import { CellLines } from "../admin/states";
import { FormSkeleton } from "../settings/states";
import { DataTableSkeleton } from "@shopper/ui/components/table/skeleton";

// Two-line rows fill a tall laptop screen; the table clips what does not fit, as the loaded one scrolls it.
const SUMMARY_ROWS = 14;
const RATE_ROWS = 3;

/** Nothing was sold or credited in the range: say so and what to try. */
export function NothingTaxed({ what }: { what: string }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ReceiptTextIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>No sales in {what}</EmptyTitle>
        <EmptyDescription>
          Pick another range. Sales show here once the tills have sent them.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** The three totals and the table of the summary, under filters that are already drawn. */
export function SummaryResultsSkeleton() {
  return (
    <>
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading the tax summary"
        className="grid gap-4 sm:grid-cols-3"
      >
        {[0, 1, 2].map((tile) => (
          <div key={tile} className="rounded-lg border p-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-1 h-8 w-32" />
          </div>
        ))}
      </div>
      <DataTableSkeleton
        className="min-h-52"
        rows={SUMMARY_ROWS}
        columns={[
          { header: "Period", cell: <CellLines lines={["h-5 w-24", "h-4 w-40"]} /> },
          { header: "Sales before tax", className: MONEY_FROM_MD, cell: <Money /> },
          { header: "VAT", className: MONEY_FROM_MD, cell: <Money /> },
          { header: "NHIL + GETFund", className: MONEY_FROM_MD, cell: <Money /> },
          { header: "Credit notes", className: MONEY_FROM_MD, cell: <Money /> },
          { header: "Net tax", className: "text-right", cell: <Money /> },
        ]}
      />
    </>
  );
}

const MONEY_FROM_MD = "hidden text-right md:table-cell";

function Money() {
  return <Skeleton className="ml-auto h-5 w-20" />;
}

/** The summary's filters and results, while the tab itself loads. */
export function SummarySkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        {["w-8", "w-5"].map((label) => (
          <div key={label} className="flex flex-col gap-2">
            <Skeleton className={`h-3.5 ${label}`} />
            <Skeleton className="h-8 w-44" />
          </div>
        ))}
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-16" />
          <div className="flex h-9 items-center gap-4">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </div>
      <SummaryResultsSkeleton />
    </div>
  );
}

/** The month field and the return's worksheet. */
export function ReturnSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div aria-hidden className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-12" />
        <Skeleton className="h-8 w-48" />
      </div>
      <ReturnSheet />
    </div>
  );
}

/** The month's worksheet alone, in two columns from lg, under a month field that is already drawn. */
export function ReturnSheet() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading the VAT return"
      className="grid gap-6 lg:grid-cols-2"
    >
      <div className="flex flex-col gap-6">
        <Skeleton className="h-79 rounded-lg" />
        <Skeleton className="h-56.5 rounded-lg" />
      </div>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-99.2 rounded-lg" />
        <Skeleton className="h-22.75 rounded-lg" />
      </div>
    </div>
  );
}

/** The dated rates, each row with its rates, source and status. */
export function RatesSkeleton() {
  return (
    <DataTableSkeleton
      label="Loading tax rates"
      rows={RATE_ROWS}
      columns={[
        {
          header: "Starts",
          cell: (
            <div className="flex flex-col gap-1">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-16 md:hidden" />
            </div>
          ),
        },
        { header: "VAT", className: "text-right", cell: <Rate /> },
        { header: "NHIL", className: "hidden text-right md:table-cell", cell: <Rate /> },
        { header: "GETFund", className: "hidden text-right md:table-cell", cell: <Rate /> },
        { header: "COVID-19", className: "hidden text-right md:table-cell", cell: <Rate /> },
        {
          header: "Source",
          className: "hidden md:table-cell",
          cell: <Skeleton className="h-5 w-48" />,
        },
        {
          header: "Status",
          className: "hidden md:table-cell",
          cell: <Skeleton className="h-5 w-16" />,
        },
        {
          header: "Actions",
          className: "text-right",
          cell: <Skeleton className="ml-auto h-7 w-24" />,
        },
      ]}
    />
  );
}

function Rate() {
  return <Skeleton className="ml-auto h-5 w-12" />;
}

/** How the settings apply. Static, so the loading tab shows it too. */
export function TaxSettingsNote() {
  return (
    <p className="text-sm text-muted-foreground">
      How every till charges tax. A change reaches the tills on their next sync; sales already made
      keep their tax.
    </p>
  );
}

/** The tax settings: the note, then the switch, three text fields, two choices and Save. */
export function TaxSettingsSkeleton() {
  return (
    <div className="flex max-w-2xl flex-col gap-6 pb-6">
      <TaxSettingsNote />
      <FormSkeleton
        label="Loading tax settings"
        fields={["switch-note", "text", "text", "choice", "choice"]}
        saveWidth="w-34.5"
      />
    </div>
  );
}

/** Schedule new rates, which only a member who may write rates sees. */
export function RulesActionSkeleton() {
  return usePermissions()?.includes("tax.write") ? <Skeleton className="h-8 w-43.25" /> : null;
}
