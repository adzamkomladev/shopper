import { useState } from "react";
import { CircleAlertIcon, Loader2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { focusOnMount } from "../../../lib/focus";
import { MOD_KEY } from "../../../lib/mod/key";
import { FileDrop } from "../../../components/catalogue/imports/file/drop";
import { ImportDone } from "../../../components/catalogue/imports/done";
import { ImportReport } from "../../../components/catalogue/imports/report";
import { importFailure, useCheckImport, useRunImport } from "../../../queries/catalogue/imports";
import { useImportShortcuts } from "../../../hooks/catalogue/imports/shortcuts";

const OFFLINE_NOTE_ID = "check-offline-note";
const TITLE_ID = "import-title";

export function ImportsScreen() {
  const online = useOnline();
  const [file, setFile] = useState<File | null>(null);
  const check = useCheckImport();
  const run = useRunImport();
  const busy = check.isPending || run.isPending;
  const report = check.data;

  // Choosing a different file throws away the old check.
  function choose(next: File | null) {
    setFile(next);
    check.reset();
  }
  function startOver() {
    choose(null);
    run.reset();
    // The button that was clicked is about to unmount; keep the keyboard in the page.
    document.getElementById(TITLE_ID)?.focus();
  }
  function next() {
    if (!online || busy || run.isSuccess || !file) return;
    if (!report) check.mutate(file);
    else if (report.rowsOk > 0) run.mutate(report.assetId);
  }
  const shortcuts = useImportShortcuts({ next });
  // Why the button is disabled, read out with it.
  const describedBy =
    [!online && OFFLINE_NOTE_ID, !file && "spreadsheet-file spreadsheet-error"]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div ref={shortcuts} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1
          id={TITLE_ID}
          ref={focusOnMount}
          tabIndex={-1}
          className="text-3xl font-bold tracking-tight outline-none"
        >
          Import products
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Add or update many products from a CSV or Excel file. Check it first: products change only
          when you import. Every file needs SKU, Name and Selling Price columns, and new products
          also need Tax Class.
        </p>
      </div>
      {run.data ? (
        <ImportDone result={run.data} onImportAnother={startOver} />
      ) : report ? (
        <ImportReport
          report={report}
          running={run.isPending}
          online={online}
          error={run.error}
          onRun={next}
          onChooseAnother={startOver}
        />
      ) : (
        <>
          <FileDrop file={file} onChoose={choose} disabled={busy} />
          {check.error && (
            <Alert variant="destructive">
              <CircleAlertIcon aria-hidden />
              <AlertDescription>{importFailure(check.error)}</AlertDescription>
            </Alert>
          )}
          {!online && (
            <p id={OFFLINE_NOTE_ID} className="text-sm text-muted-foreground">
              You're offline. Reconnect to check your file.
            </p>
          )}
          <div>
            <Button
              type="button"
              disabled={!file || !online || check.isPending}
              aria-describedby={describedBy}
              onClick={next}
            >
              {check.isPending ? (
                <>
                  <Loader2Icon aria-hidden className="animate-spin" />
                  Checking…
                </>
              ) : (
                <>
                  Check file
                  <Kbd aria-hidden>{MOD_KEY} ↵</Kbd>
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
