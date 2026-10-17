import type { SettingsDraft } from "../../schemas/settings";
import { SettingsCard, SettingsSwitch } from "./card";

export function CashierCard({
  draft,
  disabled,
  onChange,
}: {
  draft: SettingsDraft;
  disabled: boolean;
  onChange: (change: Partial<SettingsDraft>) => void;
}) {
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
        description="Ask for a manager PIN before processing a return. Enforced when returns open."
        disabled={disabled}
        id="settings-require-pin"
        label="Require PIN for returns"
        onChange={(requirePinForReturns) => onChange({ requirePinForReturns })}
      />
    </SettingsCard>
  );
}
