import { Printer, Trash2 } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import type { SettingsDraft } from "../../schemas/settings";
import type { DraftErrors, PortList } from "../../settings/types";
import { SelectField, TextField } from "./field";
import { useFocusRef } from "./focus";
import { PortPicker } from "./ports";
import { SerialFields } from "./serial";

type PrinterDraft = NonNullable<SettingsDraft["printer"]>;
const models = [
  ["epson", "Epson"],
  ["xprinter", "Xprinter"],
  ["bixolon", "Bixolon"],
] as const;
const connections = [
  ["network", "Network"],
  ["usb", "USB"],
  ["serial", "Serial port"],
] as const;
export const modelName = (model: PrinterDraft["model"]) =>
  models.find(([value]) => value === model)![1];

/** The empty state: receipts are kept but nothing prints until a printer is added. */
export function NoPrinter({ disabled, onAdd }: { disabled: boolean; onAdd: () => void }) {
  const addRef = useFocusRef("settings-add-printer");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5 rounded-xl border border-dashed px-2 py-1.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
          <Printer aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm leading-none font-medium">No printer set up</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Receipts are saved on this register but not printed.
          </p>
        </div>
      </div>
      <div>
        <Button
          aria-keyshortcuts="Alt+E"
          disabled={disabled}
          onClick={onAdd}
          ref={addRef}
          size="touch"
          type="button"
          variant="outline"
        >
          Add printer <Kbd className="max-sm:hidden">Alt+E</Kbd>
        </Button>
      </div>
    </div>
  );
}

/** Model and connection of the printer; the page's Save changes stores them. */
export function PrinterEditor({
  id,
  printer,
  list,
  errors,
  disabled,
  onChange,
  onRemove,
  onRefresh,
}: {
  id: string;
  printer: PrinterDraft;
  list: PortList;
  errors: DraftErrors;
  disabled: boolean;
  onChange: (change: Partial<PrinterDraft>) => void;
  onRemove: () => void;
  onRefresh: () => void;
}) {
  return (
    <div
      aria-label="Edit printer"
      className="flex flex-col gap-3 rounded-lg border p-3"
      id={id}
      role="group"
    >
      <h3 className="text-sm font-medium">Edit printer</h3>
      <div className="grid items-start gap-3 sm:grid-cols-2">
        <SelectField
          disabled={disabled}
          id="settings-printer-model"
          label="Printer model"
          onChange={(model) =>
            onChange({ model: models.find(([value]) => value === model)?.[0] ?? "epson" })
          }
          options={models}
          value={printer.model}
        />
        <SelectField
          disabled={disabled}
          id="settings-printer-kind"
          label="Connection"
          onChange={(kind) =>
            onChange({ kind: connections.find(([value]) => value === kind)?.[0] ?? "network" })
          }
          options={connections}
          value={printer.kind}
        />
      </div>
      {printer.kind === "network" && (
        <div className="grid items-start gap-3 sm:grid-cols-3">
          <TextField
            className="sm:col-span-2"
            readOnly={disabled}
            error={errors["printer.host"]}
            id="settings-printer-host"
            label="IP address or host name"
            onChange={(host) => onChange({ host })}
            value={printer.host}
          />
          <TextField
            readOnly={disabled}
            error={errors["printer.port"]}
            id="settings-printer-port"
            inputMode="numeric"
            label="Port"
            onChange={(port) => onChange({ port })}
            value={printer.port}
          />
        </div>
      )}
      {printer.kind === "usb" && (
        <PortPicker
          choices={list.usb.map((name) => [name, name] as const)}
          disabled={disabled}
          emptyHint="No printers found. Type the name as Windows lists it."
          error={errors["printer.printerName"]}
          id="settings-printer-name"
          label="Printer name"
          list={list}
          note="USB printers work on Windows."
          onChange={(printerName) => onChange({ printerName })}
          onRefresh={onRefresh}
          value={printer.printerName}
        />
      )}
      {printer.kind === "serial" && (
        <SerialFields
          device={printer}
          disabled={disabled}
          errors={errors}
          id="printer"
          list={list}
          onChange={onChange}
          onRefresh={onRefresh}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Saved with Save changes. Used from the next receipt.
        </p>
        <Button
          aria-keyshortcuts="Alt+X"
          className="text-destructive hover:text-destructive"
          disabled={disabled}
          onClick={onRemove}
          size="touch"
          type="button"
          variant="ghost"
        >
          <Trash2 aria-hidden="true" /> Remove printer <Kbd className="max-sm:hidden">Alt+X</Kbd>
        </Button>
      </div>
    </div>
  );
}
