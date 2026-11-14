import { useQuery } from "@tanstack/react-query";
import { ARCHIVE_ID, ArchiveCard } from "../../components/export/archive";
import { CSV_ID, ENTITY_ID, EXCEL_ID, SpreadsheetCard } from "../../components/export/spreadsheet";
import { Gate } from "../../components/register/states";
import { PageSkeleton } from "../../components/route/states";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { focusIfIdle } from "../../lib/focus";
import { archivesQuery, exportEntitiesQuery } from "../../queries/export";

/** Taking the business's data out: a spreadsheet at a time, or the whole of it as one signed archive. */
export function ExportScreen() {
  const shortcuts = useShortcuts({
    E: () => document.getElementById(ENTITY_ID)?.focus(),
    C: () => document.getElementById(CSV_ID)?.click(),
    X: () => document.getElementById(EXCEL_ID)?.click(),
    A: () => document.getElementById(ARCHIVE_ID)?.click(),
  });
  return (
    <div ref={shortcuts} className="flex flex-col gap-6">
      <h1
        tabIndex={-1}
        ref={focusIfIdle}
        className="text-2xl font-semibold tracking-tight outline-none"
      >
        Data export
      </h1>
      <Gate need="export.run" what="data export" verb="export" fallback={<PageSkeleton />}>
        <Export />
      </Gate>
    </div>
  );
}

function Export() {
  const entities = useQuery(exportEntitiesQuery());
  const archives = useQuery(archivesQuery());
  return (
    <>
      <SpreadsheetCard entities={entities.data} />
      <ArchiveCard data={archives.data} failed={archives.isError} />
    </>
  );
}
