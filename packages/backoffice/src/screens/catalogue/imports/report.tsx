import { CircleAlertIcon, CircleCheckIcon, Loader2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Kbd } from "@shopper/ui/components/kbd";
import { focusOnMount } from "../../../lib/focus";
import { MOD_KEY } from "../../../lib/mod-key";
import { importFailure, type ImportPreview } from "./queries";

type ImportError = ImportPreview["errors"][number];
type Props = {
  report: ImportPreview;
  running: boolean;
  online: boolean;
  error: Error | null;
  onRun: () => void;
  onChooseAnother: () => void;
};

const OFFLINE_NOTE_ID = "import-offline-note";
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

// Phones fold the column name into the Problem cell instead of giving it a column.
const DESKTOP_ONLY = "hidden md:table-cell";

const columns: DataTableColumn<ImportError>[] = [
  { id: "row", header: "Row", cell: ({ row }) => row.original.row },
  {
    id: "column",
    header: "Column",
    meta: { className: DESKTOP_ONLY },
    cell: ({ row }) => row.original.column,
  },
  {
    id: "problem",
    header: "Problem",
    cell: ({ row }) => (
      <div className="flex flex-col whitespace-normal">
        <span className="text-xs font-semibold md:hidden">{row.original.column}</span>
        <span>{row.original.message}</span>
        {row.original.value && (
          <span className="text-xs break-all text-muted-foreground">
            In the file: {row.original.value}
          </span>
        )}
      </div>
    ),
  },
];

/** What the dry run found: counts, the choice to import the good rows, then the bad rows. */
export function ImportReport({ report, running, online, error, onRun, onChooseAnother }: Props) {
  const empty = report.rowsTotal === 0;
  const none = report.rowsOk === 0;
  return (
    <div
      ref={focusOnMount}
      tabIndex={-1}
      aria-busy={running}
      className="flex flex-col gap-6 outline-none"
    >
      {empty ? (
        <Alert>
          <CircleAlertIcon aria-hidden />
          <AlertDescription>
            The file has no product rows. Add them under the header row, then choose it again.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 font-medium">
            <CircleCheckIcon aria-hidden className="size-5 text-primary" />
            <span>{plural(report.rowsOk, "row ready to import", "rows ready to import")}</span>
          </p>
          <p className="flex items-center gap-2 font-medium">
            <CircleAlertIcon
              aria-hidden
              className={
                report.rowsFailed ? "size-5 text-destructive" : "size-5 text-muted-foreground"
              }
            />
            <span>{plural(report.rowsFailed, "row with errors", "rows with errors")}</span>
          </p>
          {!none && (
            <p className="text-sm text-muted-foreground">
              Importing adds {plural(report.created, "new product", "new products")}, updates{" "}
              {report.updated} and leaves {report.unchanged} as they are.
              {report.rowsFailed > 0 && " Rows with errors are skipped."}
            </p>
          )}
        </div>
      )}
      {none && !empty && (
        <Alert>
          <CircleAlertIcon aria-hidden />
          <AlertDescription>
            No row can be imported yet. Fix the rows below in your file, then choose it again.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden />
          <AlertDescription>{importFailure(error)}</AlertDescription>
        </Alert>
      )}
      {!online && (
        <p id={OFFLINE_NOTE_ID} className="text-sm text-muted-foreground">
          You're offline. Reconnect to import.
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          disabled={none || running || !online}
          aria-describedby={online ? undefined : OFFLINE_NOTE_ID}
          onClick={onRun}
        >
          {running ? (
            <>
              <Loader2Icon aria-hidden className="animate-spin" />
              Importing…
            </>
          ) : none ? (
            "Import products"
          ) : (
            <>
              Import {plural(report.rowsOk, "product", "products")}
              <Kbd aria-hidden>{MOD_KEY} ↵</Kbd>
            </>
          )}
        </Button>
        <Button type="button" variant="outline" disabled={running} onClick={onChooseAnother}>
          Choose another file
        </Button>
      </div>
      {report.errors.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Rows to fix</h2>
          <DataTable
            label="Rows with errors"
            columns={columns}
            data={report.errors}
            getRowId={(error) => `${error.row}-${error.column}-${error.message}`}
            className="max-h-96"
          />
        </section>
      )}
    </div>
  );
}
