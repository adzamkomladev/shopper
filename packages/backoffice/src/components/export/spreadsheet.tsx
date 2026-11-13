import { useState } from "react";
import { FileSpreadsheetIcon, FileTextIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shopper/ui/components/card";
import { Label } from "@shopper/ui/components/label";
import { DatePicker } from "@shopper/ui/components/picker/date";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shopper/ui/components/select";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { useEntityDownload } from "../../queries/export";
import { ENTITY_LABELS, type EntityName } from "../../schemas/export";

export const ENTITY_ID = "export-entity";
export const CSV_ID = "export-csv";
export const EXCEL_ID = "export-excel";

const today = () => new Date().toISOString().slice(0, 10);

/** One list or history as a spreadsheet: pick what, the dates when it is history, then CSV or Excel. */
export function SpreadsheetCard({
  entities,
}: {
  entities?: { name: EntityName; ranged: boolean }[];
}) {
  const download = useEntityDownload();
  const [entity, setEntity] = useState<EntityName>("products");
  const [range, setRange] = useState({ from: `${today().slice(0, 8)}01`, to: today() });
  const ranged = entities?.find((item) => item.name === entity)?.ranged ?? false;
  const ask = (format: "csv" | "xlsx") =>
    download.mutate({ entity, format, ...(ranged ? range : {}) });
  return (
    <Card aria-busy={!entities}>
      <CardHeader>
        <CardTitle className="text-base">Download a spreadsheet</CardTitle>
        <CardDescription>
          One list or history at a time, to open in Excel or send to your accountant.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!entities ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3 max-sm:flex-col max-sm:items-stretch">
              <div className="flex flex-col gap-2 sm:w-56">
                <Label htmlFor={ENTITY_ID}>What to export</Label>
                <Select value={entity} onValueChange={(value) => setEntity(value as EntityName)}>
                  <SelectTrigger id={ENTITY_ID} className="w-full" aria-keyshortcuts="E">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {entities.map((item) => (
                      <SelectItem key={item.name} value={item.name}>
                        {ENTITY_LABELS[item.name].title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {ranged && (
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="export-from">From</Label>
                    <DatePicker
                      id="export-from"
                      value={range.from}
                      max={range.to}
                      onValueChange={(from) => from && setRange({ ...range, from })}
                      className="w-full sm:w-40"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="export-to">To</Label>
                    <DatePicker
                      id="export-to"
                      value={range.to}
                      min={range.from}
                      onValueChange={(to) => to && setRange({ ...range, to })}
                      className="w-full sm:w-40"
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-2 sm:ml-auto">
                <Button
                  id={CSV_ID}
                  variant="outline"
                  aria-keyshortcuts="C"
                  aria-busy={download.isPending}
                  onClick={() => ask("csv")}
                >
                  <FileTextIcon aria-hidden />
                  CSV
                </Button>
                <Button
                  id={EXCEL_ID}
                  aria-keyshortcuts="X"
                  aria-busy={download.isPending}
                  onClick={() => ask("xlsx")}
                >
                  <FileSpreadsheetIcon aria-hidden />
                  Excel
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{ENTITY_LABELS[entity].hint}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
