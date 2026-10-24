import type { TaxSettingsView } from "../../../schemas/tax/settings";
import { ReadOnlyNote } from "../../admin/states";

/** The tax settings for a member who may read but not change them. */
export function TaxSettingsSummary({ settings }: { settings: TaxSettingsView }) {
  const rows = [
    [
      "VAT-registered",
      settings.vatRegisteredFrom ? `Yes, from ${settings.vatRegisteredFrom}` : "No",
    ],
    ["Business TIN", settings.tin ?? "Not given"],
    [
      "Shelf prices",
      settings.priceMode === "inclusive" ? "Include VAT and levies" : "VAT and levies added",
    ],
    ["Cash rounding", settings.cashRounding === "10p" ? "Nearest 10 pesewas" : "None"],
  ];
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-[max-content_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <ReadOnlyNote>Only a super admin can change the tax settings.</ReadOnlyNote>
    </div>
  );
}
