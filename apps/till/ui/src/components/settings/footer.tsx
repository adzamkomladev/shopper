import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { modLabel } from "@shopper/ui/hooks/modkey";
import { readOnlyReason } from "./devices";

// A disabled button keeps full-strength text on a muted fill, so its label and shortcut stay readable.
const quiet = "disabled:bg-muted disabled:text-kbd-foreground disabled:opacity-100";

export function SettingsFooter({
  canEdit,
  dirty,
  saving,
  stale,
  onCancel,
}: {
  canEdit: boolean;
  dirty: boolean;
  saving: boolean;
  /** Another screen saved first; the notice above says how to continue. */
  stale: boolean;
  onCancel: () => void;
}) {
  const note = !canEdit
    ? `${readOnlyReason}.`
    : stale
      ? "Reload settings to continue. Another screen saved first."
      : dirty
        ? "Changes apply to this register only."
        : "No changes to save. Changes apply to this register only.";
  const canSave = canEdit && dirty && !saving && !stale;
  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t pt-4">
      <p className="text-xs text-muted-foreground" id="settings-footer-note">
        {note}
      </p>
      <div className="flex w-full gap-3 sm:w-auto">
        <Button
          aria-keyshortcuts="Escape"
          className={`flex-1 sm:flex-none ${quiet}`}
          disabled={!dirty || saving}
          onClick={onCancel}
          size="touch"
          type="button"
          variant="outline"
        >
          Cancel <Kbd className="max-sm:hidden">Esc</Kbd>
        </Button>
        <Button
          aria-describedby="settings-footer-note"
          aria-keyshortcuts="Control+S Meta+S"
          className={`flex-1 sm:flex-none ${saving ? "disabled:opacity-80" : quiet}`}
          disabled={!canSave}
          size="touch"
          type="submit"
          variant={canSave || saving ? "default" : "secondary"}
        >
          {saving ? "Saving…" : "Save changes"} <Kbd className="max-sm:hidden">{modLabel("S")}</Kbd>
        </Button>
      </div>
    </footer>
  );
}
