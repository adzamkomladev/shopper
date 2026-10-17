import { Barcode, CircleCheck, Printer } from "lucide-react";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import type { SettingsDraft } from "../../schemas/settings";
import { deviceMessage, printerBadge, printTime } from "../../settings/draft";
import type {
  DeviceFeedback,
  DraftErrors,
  PrinterBadge as BadgeKind,
  PrinterStatus,
} from "../../settings/types";
import { SettingsCard } from "./card";
import { useFocusRef } from "./focus";
import { modelName, NoPrinter, PrinterEditor } from "./printer";

export const readOnlyReason = "Ask a manager to change register settings";
const unsavedReason = "Save changes to test this printer";

type Props = {
  draft: SettingsDraft;
  errors: DraftErrors;
  status: PrinterStatus;
  canEdit: boolean;
  /** The printer on screen differs from the one the host has saved. */
  unsaved: boolean;
  editing: boolean;
  device: DeviceFeedback | null;
  onEditing: () => void;
  onPrinter: (change: Partial<NonNullable<SettingsDraft["printer"]>>) => void;
  onAdd: () => void;
  onRemove: () => void;
  onTest: () => void;
  onDrawer: () => void;
};

export function DevicesCard(props: Props) {
  const { draft, canEdit, device } = props;
  return (
    <SettingsCard description="Hardware available to this register." title="Connected devices">
      {draft.printer ? (
        <PrinterRow {...props} printer={draft.printer} />
      ) : (
        <NoPrinter disabled={!canEdit} onAdd={props.onAdd} />
      )}
      {device && <DeviceMessage device={device} />}
      <DeviceRow
        description="USB keyboard input"
        icon={<Barcode aria-hidden="true" className="size-4" />}
        title="Barcode scanner"
      />
    </SettingsCard>
  );
}

function PrinterRow({
  printer,
  draft,
  errors,
  status,
  canEdit,
  unsaved,
  editing,
  device,
  onEditing,
  onPrinter,
  onRemove,
  onTest,
  onDrawer,
}: Props & { printer: NonNullable<SettingsDraft["printer"]> }) {
  const editRef = useFocusRef("settings-edit-printer");
  const running = device?.status === "running";
  const reason = !canEdit ? readOnlyReason : unsaved ? unsavedReason : null;
  const badge = unsaved ? "unsaved" : printerBadge(status);
  const offlineMessage = !unsaved && badge === "offline" ? status.lastJob?.message : null;
  // The host keeps no timestamp for its last job; the time is known only for a test made on this screen.
  const printedAt = device?.status === "done" && device.action === "test" ? device.at : null;
  const succeeded =
    badge === "connected"
      ? `Last print succeeded${printedAt ? ` at ${printTime(printedAt)}` : ""}`
      : undefined;
  return (
    <div className="flex flex-col gap-2">
      <DeviceRow
        badge={<PrinterBadge badge={badge} />}
        description={`${where(printer)} · ${draft.paperMm} mm paper`}
        icon={<Printer aria-hidden="true" className="size-4" />}
        note={succeeded}
        title={`${modelName(printer.model)} printer`}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          aria-describedby={reason ? "settings-printer-reason" : undefined}
          aria-keyshortcuts="Alt+R"
          disabled={!!reason || running}
          onClick={onTest}
          size="touch"
          type="button"
          variant="outline"
        >
          {running && device.action === "test" ? "Printing…" : "Test print"}{" "}
          <Kbd className="max-sm:hidden">Alt+R</Kbd>
        </Button>
        <Button
          aria-describedby={reason ? "settings-printer-reason" : undefined}
          aria-keyshortcuts="Alt+D"
          disabled={!!reason || running}
          onClick={onDrawer}
          size="touch"
          type="button"
          variant="outline"
        >
          {running && device.action === "drawer" ? "Opening…" : "Open drawer"}{" "}
          <Kbd className="max-sm:hidden">Alt+D</Kbd>
        </Button>
        <Button
          aria-controls="settings-printer-editor"
          aria-expanded={editing}
          aria-keyshortcuts="Alt+E"
          disabled={!canEdit}
          id="settings-edit-printer"
          onClick={onEditing}
          ref={editRef}
          size="touch"
          type="button"
          variant={editing ? "secondary" : "ghost"}
        >
          Edit printer <Kbd className="max-sm:hidden">Alt+E</Kbd>
        </Button>
      </div>
      {reason && (
        <p className="text-xs text-muted-foreground" id="settings-printer-reason">
          {reason}
        </p>
      )}
      {offlineMessage && (
        <p className="text-xs text-destructive">
          Last print failed: {offlineMessage.replace(/\.$/, "")}. Check the printer is on and on the
          same network.
        </p>
      )}
      {editing && (
        <PrinterEditor
          disabled={!canEdit}
          errors={errors}
          id="settings-printer-editor"
          onChange={onPrinter}
          onRemove={onRemove}
          printer={printer}
        />
      )}
    </div>
  );
}

function PrinterBadge({ badge }: { badge: BadgeKind | "unsaved" }) {
  if (badge === "connected")
    return (
      <Badge className="bg-success/10 text-foreground">
        <CircleCheck aria-hidden="true" className="text-success" /> Connected
      </Badge>
    );
  if (badge === "offline") return <Badge variant="destructive">Offline</Badge>;
  return <Badge variant="outline">{badge === "unsaved" ? "Not saved" : "Not checked"}</Badge>;
}

function DeviceRow({
  icon,
  title,
  description,
  note,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  /** A second muted line, for what the badge is based on. */
  note?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border bg-card px-2 py-1.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-none font-medium">{title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
        {note && <p className="truncate text-xs text-muted-foreground">{note}</p>}
      </div>
      {badge}
    </div>
  );
}

function DeviceMessage({ device }: { device: DeviceFeedback }) {
  if (device.status === "failed")
    return (
      <p className="text-sm text-destructive" role="alert">
        {deviceMessage(device)}
      </p>
    );
  return (
    <p className="text-sm text-muted-foreground" role="status">
      {deviceMessage(device)}
    </p>
  );
}

const where = (printer: NonNullable<SettingsDraft["printer"]>) =>
  printer.kind === "usb"
    ? `USB · ${printer.printerName || "No printer"}`
    : printer.kind === "serial"
      ? `Serial · ${printer.path || "No port"} @ ${printer.baudRate}`
      : `Network · ${printer.host || "No address"}:${printer.port}`;
