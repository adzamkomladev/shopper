import { Label } from "@shopper/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shopper/ui/components/select";
import type { SettingsDraft } from "../../schemas/settings";
import { SettingsCard, SettingsSwitch } from "./card";

export function ReceiptsCard({
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
      description="Choose how receipts are printed after a sale."
      title="Receipt preferences"
    >
      <SettingsSwitch
        checked={draft.printAutomatically}
        description="Print a receipt after every completed purchase."
        disabled={disabled}
        id="settings-print-automatically"
        label="Print receipts automatically"
        onChange={(printAutomatically) => onChange({ printAutomatically })}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="settings-paper-width">Receipt paper width</Label>
        <Select
          disabled={disabled}
          onValueChange={(value) => onChange({ paperMm: value === "58" ? 58 : 80 })}
          value={String(draft.paperMm)}
        >
          <SelectTrigger className="w-full" id="settings-paper-width" size="touch">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem className="min-h-11" value="80">
              80 mm · Standard thermal
            </SelectItem>
            <SelectItem className="min-h-11" value="58">
              58 mm · Narrow thermal
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </SettingsCard>
  );
}
