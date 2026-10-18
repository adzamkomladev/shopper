import { Barcode, Monitor } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { baudRates, type SerialDraft } from "../../schemas/settings";
import type { DraftErrors, PortList } from "../../settings/types";
import { newSerial } from "../../settings/draft";
import { SelectField } from "./field";
import { useFocusRef } from "./focus";
import { PortPicker } from "./ports";
import { DeviceRow } from "./row";

const baudOptions = baudRates.map((rate) => [rate, rate] as const);
export const portChoices = (list: PortList) =>
  list.serial.map(
    ({ path, manufacturer }) => [path, manufacturer ? `${path} · ${manufacturer}` : path] as const,
  );

/** Port and speed of a serial device. `id` prefixes the ids and error keys, like `printer` or `scanner`. */
export function SerialFields({
  id,
  device,
  list,
  errors,
  disabled,
  onChange,
  onRefresh,
}: {
  id: "printer" | "scanner" | "display";
  device: SerialDraft;
  list: PortList;
  errors: DraftErrors;
  disabled: boolean;
  onChange: (change: Partial<SerialDraft>) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="grid items-start gap-3 sm:grid-cols-3">
      <div className="sm:col-span-2">
        <PortPicker
          choices={portChoices(list)}
          disabled={disabled}
          emptyHint="No serial ports found. Plug the device in, then refresh."
          error={errors[`${id}.path`]}
          id={`settings-${id}-path`}
          label="Port"
          list={list}
          onChange={(path) => onChange({ path })}
          onRefresh={onRefresh}
          value={device.path}
        />
      </div>
      <SelectField
        disabled={disabled}
        error={errors[`${id}.baudRate`]}
        id={`settings-${id}-baud`}
        label="Baud rate"
        onChange={(baudRate) => onChange({ baudRate })}
        options={baudOptions}
        value={device.baudRate}
      />
    </div>
  );
}

const kinds = {
  scanner: {
    title: "Barcode scanner",
    icon: <Barcode aria-hidden="true" className="size-4" />,
    standard: ["keyboard", "Keyboard (USB)"],
    standardText: "USB keyboard input",
    serial: ["serial", "Serial port"],
    serialText: "Serial",
    connection: "Scanner connection",
    edit: "Edit scanner",
    key: "Alt+B",
  },
  display: {
    title: "Customer display",
    icon: <Monitor aria-hidden="true" className="size-4" />,
    standard: ["screen", "Second screen"],
    standardText: "Second screen when one is connected",
    serial: ["serial", "Pole display (serial)"],
    serialText: "Pole display",
    connection: "Display connection",
    edit: "Edit display",
    key: "Alt+M",
  },
} as const;

/** A scanner or customer display: its row, and an editor that switches it between the default and a serial port. */
export function SerialDevice({
  kind,
  device,
  list,
  errors,
  canEdit,
  editing,
  onToggle,
  onChange,
  onRefresh,
}: {
  kind: keyof typeof kinds;
  device: SerialDraft | null;
  list: PortList;
  errors: DraftErrors;
  canEdit: boolean;
  editing: boolean;
  onToggle: () => void;
  /** `null` goes back to the default connection. */
  onChange: (device: SerialDraft | null) => void;
  onRefresh: () => void;
}) {
  const k = kinds[kind];
  const editRef = useFocusRef(`settings-edit-${kind}`);
  const description = device
    ? `${k.serialText} · ${device.path || "No port"} @ ${device.baudRate}`
    : k.standardText;
  return (
    <div className="flex flex-col gap-2">
      <DeviceRow description={description} icon={k.icon} title={k.title} />
      <div>
        <Button
          aria-controls={`settings-${kind}-editor`}
          aria-expanded={editing}
          aria-keyshortcuts={k.key}
          disabled={!canEdit}
          id={`settings-edit-${kind}`}
          onClick={onToggle}
          ref={editRef}
          size="touch"
          type="button"
          variant={editing ? "secondary" : "ghost"}
        >
          {k.edit} <Kbd className="max-sm:hidden">{k.key}</Kbd>
        </Button>
      </div>
      {editing && (
        <div
          aria-label={k.edit}
          className="flex flex-col gap-3 rounded-lg border p-3"
          id={`settings-${kind}-editor`}
          role="group"
        >
          <SelectField
            disabled={!canEdit}
            id={`settings-${kind}-connection`}
            label={k.connection}
            onChange={(next) => onChange(next === k.serial[0] ? { ...newSerial } : null)}
            options={[k.standard, k.serial]}
            value={device ? k.serial[0] : k.standard[0]}
          />
          {device && (
            <SerialFields
              device={device}
              disabled={!canEdit}
              errors={errors}
              id={kind}
              list={list}
              onChange={(change) => onChange({ ...device, ...change })}
              onRefresh={onRefresh}
            />
          )}
        </div>
      )}
    </div>
  );
}
