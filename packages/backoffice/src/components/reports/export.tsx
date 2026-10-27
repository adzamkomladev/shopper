import { DownloadIcon, FileSpreadsheetIcon, FileTextIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@shopper/ui/components/dropdown-menu";
import { Kbd } from "@shopper/ui/components/kbd";
import { useReportExport } from "../../queries/reports/reports";
import type { ReportKind } from "../../schemas/reports/views";

type Props = {
  kind: ReportKind;
  params: Record<string, string | undefined>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled: boolean;
};

/** Downloads the report as it is shown, as CSV or an Excel workbook (`E` opens it). */
export function ExportMenu({ kind, params, open, onOpenChange, disabled }: Props) {
  const download = useReportExport(kind, params);

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          className="sm:ml-auto"
          // Kept enabled while a file downloads: disabling it would drop focus, and the shortcuts with it.
          disabled={disabled}
          aria-busy={download.isPending}
          aria-keyshortcuts="E"
        >
          <DownloadIcon aria-hidden />
          {download.isPending ? "Exporting…" : "Export"}
          <Kbd aria-hidden>E</Kbd>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={download.isPending} onSelect={() => download.mutate("csv")}>
          <FileTextIcon aria-hidden />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem disabled={download.isPending} onSelect={() => download.mutate("xlsx")}>
          <FileSpreadsheetIcon aria-hidden />
          Excel workbook
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
