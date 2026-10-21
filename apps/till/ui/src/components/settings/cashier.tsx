import { useState } from "react";
import { cedisText, cedisValue, parseCedis } from "../../shift/amount";
import type { SettingsDraft } from "../../schemas/settings";
import type { DraftErrors } from "../../settings/types";
import { SettingsCard, SettingsSwitch } from "./card";
import { TextField } from "./field";

export function CashierCard({
  draft,
  errors,
  disabled,
  onChange,
}: {
  draft: SettingsDraft;
  errors: DraftErrors;
  disabled: boolean;
  onChange: (change: Partial<SettingsDraft>) => void;
}) {
  const days = draft.returnWindowDays;
  // The draft holds minor units; the text is what was typed, so "5." and "5.0" survive a keystroke.
  const [variance, setVariance] = useState(() => cedisValue(draft.varianceThreshold));
  return (
    <SettingsCard
      description="Keep checkout quick and sensitive actions secure."
      title="Cashier preferences"
    >
      <SettingsSwitch
        checked={draft.clearCartAfterSale}
        description="Start each new purchase with an empty cart."
        disabled={disabled}
        id="settings-clear-cart"
        label="Clear cart after a sale"
        onChange={(clearCartAfterSale) => onChange({ clearCartAfterSale })}
      />
      <SettingsSwitch
        checked={draft.requirePinForReturns}
        description="Ask for a manager PIN before processing a return."
        disabled={disabled}
        id="settings-require-pin"
        label="Require PIN for returns"
        onChange={(requirePinForReturns) => onChange({ requirePinForReturns })}
      />
      <TextField
        error={errors.returnWindowDays}
        id="settings-return-window"
        inputMode="numeric"
        label="Return window (days)"
        onChange={(text) => onChange({ returnWindowDays: toDays(text) })}
        readOnly={disabled}
        value={Number.isNaN(days) ? "" : String(days)}
      />
      <p className="-mt-1 text-xs text-muted-foreground">
        A cashier may refund a sale this many days after it. Later returns need a manager.
      </p>
      <TextField
        error={errors.varianceThreshold}
        id="settings-variance"
        inputMode="decimal"
        label="Cash variance needing a manager (GH₵)"
        onChange={(text) => {
          const typed = cedisText(text);
          setVariance(typed);
          onChange({ varianceThreshold: parseCedis(typed) ?? Number.NaN });
        }}
        readOnly={disabled}
        value={variance}
      />
      <p className="-mt-1 text-xs text-muted-foreground">
        A cashier closing with a variance above this amount needs a manager's PIN.
      </p>
    </SettingsCard>
  );
}

/** Digits only, kept as typed up to three; a blank field is NaN, which saving refuses. */
function toDays(text: string) {
  const digits = text.replace(/\D/g, "").slice(0, 3);
  return digits === "" ? Number.NaN : Number(digits);
}
