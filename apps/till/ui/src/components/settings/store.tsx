import type { SettingsDraft } from "../../schemas/settings";
import type { DraftErrors } from "../../settings/types";
import { SettingsCard } from "./card";
import { TextField } from "./field";

export function StoreCard({
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
  return (
    <SettingsCard
      description="Identify this register and the store shown on receipts."
      title="Register & store"
    >
      <TextField
        readOnly={disabled}
        error={errors.storeName}
        id="settings-store-name"
        label="Store name"
        onChange={(storeName) => onChange({ storeName })}
        value={draft.storeName}
      />
      <TextField
        readOnly={disabled}
        error={errors.registerName}
        id="settings-register-name"
        label="Register name"
        onChange={(registerName) => onChange({ registerName })}
        value={draft.registerName}
      />
    </SettingsCard>
  );
}
