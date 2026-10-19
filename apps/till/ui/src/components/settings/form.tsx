import { useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { toast } from "@shopper/ui/components/sonner";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import type { SerialDraft, SettingsDraft } from "../../schemas/settings";
import { deviceMessage, newPrinter, sameDraft, toDraft, validateDraft } from "../../settings/draft";
import type {
  DeviceFeedback,
  DraftErrors,
  SettingsActions,
  SettingsCurrent,
  SettingsSnapshot,
} from "../../settings/types";
import { CashierCard } from "./cashier";
import { DevicesCard } from "./devices";
import { createFocus, FocusContext } from "./focus";
import { SettingsFooter } from "./footer";
import { SettingsNotice } from "./notices";
import { ReceiptsCard } from "./receipts";
import { StoreCard } from "./store";

const order = [
  "storeName",
  "registerName",
  "printer.host",
  "printer.port",
  "printer.printerName",
  "printer.path",
  "scanner.path",
  "display.path",
  "returnWindowDays",
  "varianceThreshold",
] as const;
const fieldKeys: Record<(typeof order)[number], string> = {
  storeName: "settings-store-name",
  registerName: "settings-register-name",
  "printer.host": "settings-printer-host",
  "printer.port": "settings-printer-port",
  "printer.printerName": "settings-printer-name",
  "printer.path": "settings-printer-path",
  "scanner.path": "settings-scanner-path",
  "display.path": "settings-display-path",
  returnWindowDays: "settings-return-window",
  varianceThreshold: "settings-variance",
};

/**
 * The editable draft of one loaded revision. The screen remounts it with a new `key` to start over,
 * so the draft and the revision it was loaded from never drift apart.
 */
export function SettingsForm({
  current,
  snapshot,
  actions,
  active,
  onSaved,
  onReset,
  onReload,
}: {
  current: SettingsCurrent;
  snapshot: SettingsSnapshot;
  actions: SettingsActions;
  active: boolean;
  onSaved: () => void;
  onReset: () => void;
  onReload: () => void;
}) {
  const [initial] = useState(() => toDraft(current.value));
  const [loadedRevision] = useState(current.revision);
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState({ scanner: false, display: false });
  const [focus] = useState(createFocus);
  const { saving, saveError, device } = snapshot;
  const canEdit = current.canEdit && saveError?.kind !== "permission";
  const dirty = !sameDraft(draft, initial);
  const stale = current.revision !== loadedRevision || saveError?.kind === "stale";

  const printerDirty = JSON.stringify(draft.printer) !== JSON.stringify(initial.printer);
  const canTest = canEdit && !!draft.printer && !printerDirty && device?.status !== "running";

  const register = useShortcuts(
    active
      ? {
          "Mod+S": () => void submit(),
          Escape: cancel,
          "Alt+R": testPrint,
          "Alt+D": openDrawer,
          "Alt+E": toggleEditor,
          "Alt+X": removePrinter,
          "Alt+B": () => toggleDevice("scanner"),
          "Alt+M": () => toggleDevice("display"),
          "Alt+N": () => void actions.listPorts(),
          "Alt+L": () => stale && onReload(),
        }
      : {},
  );
  function change(next: Partial<SettingsDraft>) {
    setDraft((previous) => ({ ...previous, ...next }));
  }
  function changePrinter(next: Partial<NonNullable<SettingsDraft["printer"]>>) {
    if (next.kind && next.kind !== "network") void actions.listPorts();
    setDraft((previous) => ({
      ...previous,
      printer: previous.printer && { ...previous.printer, ...next },
    }));
  }
  function toggleEditor() {
    if (!canEdit) return;
    if (!draft.printer) return addPrinter();
    flushSync(() => setEditing(!editing));
    // The element that held focus may leave the page with its panel; hand focus to the next sensible one.
    focus.to(editing ? "settings-edit-printer" : "settings-printer-model");
    if (!editing && draft.printer.kind !== "network") void actions.listPorts();
  }
  function toggleDevice(kind: "scanner" | "display") {
    if (!canEdit) return;
    flushSync(() => setOpen({ ...open, [kind]: !open[kind] }));
    focus.to(open[kind] ? `settings-edit-${kind}` : `settings-${kind}-connection`);
    if (!open[kind] && draft[kind]) void actions.listPorts();
  }
  function changeSerial(kind: "scanner" | "display", device: SerialDraft | null) {
    if (device && !draft[kind]) void actions.listPorts();
    change({ [kind]: device });
  }
  function addPrinter() {
    if (!canEdit) return;
    flushSync(() => {
      change({ printer: { ...newPrinter } });
      setEditing(true);
    });
    focus.to("settings-printer-model");
  }
  function removePrinter() {
    if (!canEdit || !draft.printer) return;
    flushSync(() => {
      change({ printer: null });
      setEditing(false);
    });
    focus.to("settings-add-printer");
  }
  function cancel(event?: KeyboardEvent) {
    // Escape that closes an open list belongs to the list, not to the form.
    const inList = event?.target instanceof Element && event.target.closest("[role=listbox]");
    if (!inList && dirty) onReset();
  }
  async function runDevice(run: () => Promise<DeviceFeedback>) {
    if (!canTest) return;
    const result = await run();
    if (result.status === "done") toast.success(deviceMessage(result));
    else toast.error(deviceMessage(result));
  }
  function testPrint() {
    void runDevice(actions.testPrint);
  }
  function openDrawer() {
    void runDevice(actions.openDrawer);
  }
  async function submit() {
    if (!canEdit || saving || !dirty || stale) return;
    const result = validateDraft(draft);
    if (!result.settings) {
      flushSync(() => {
        setErrors(result.errors);
        if (Object.keys(result.errors).some((key) => key.startsWith("printer."))) setEditing(true);
        setOpen({
          scanner: open.scanner || "scanner.path" in result.errors,
          display: open.display || "display.path" in result.errors,
        });
      });
      const first = order.find((key) => result.errors[key]);
      if (first) focus.to(fieldKeys[first]);
      return;
    }
    setErrors({});
    if (await actions.save(result.settings, loadedRevision)) {
      toast.success("Register settings saved");
      onSaved();
    }
  }

  return (
    <FocusContext value={focus}>
      <form
        className="flex min-h-0 flex-1 flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        ref={register}
      >
        <SettingsNotice
          error={saveError}
          onReload={onReload}
          onRetry={() => void submit()}
          readOnly={!current.canEdit}
          stale={stale}
        />
        <div
          className="scroll-fade-y -mx-1 min-h-0 flex-1 overflow-y-auto px-1"
          tabIndex={canEdit ? undefined : 0}
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <StoreCard disabled={!canEdit} draft={draft} errors={errors} onChange={change} />
            <ReceiptsCard disabled={!canEdit} draft={draft} onChange={change} />
            <DevicesCard
              canEdit={canEdit}
              device={device}
              draft={draft}
              editing={editing}
              errors={errors}
              onAdd={addPrinter}
              onDrawer={openDrawer}
              onEditing={toggleEditor}
              onRefresh={() => void actions.listPorts()}
              onSerial={changeSerial}
              onToggle={toggleDevice}
              open={open}
              ports={snapshot.ports}
              onPrinter={changePrinter}
              onRemove={removePrinter}
              onTest={testPrint}
              status={current.printer}
              unsaved={printerDirty}
            />
            <CashierCard disabled={!canEdit} draft={draft} errors={errors} onChange={change} />
          </div>
        </div>
        <SettingsFooter
          canEdit={canEdit}
          dirty={dirty}
          onCancel={() => cancel()}
          saving={saving}
          stale={stale}
        />
      </form>
    </FocusContext>
  );
}
