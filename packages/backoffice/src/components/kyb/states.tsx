import { Skeleton } from "@shopper/ui/components/skeleton";
import { FieldSkeleton } from "../settings/states";
import type { SettingsField } from "../settings/types";

// Business, then where payouts go: the first two sections of the form, which fill a laptop screen.
const SECTIONS: { legend: string; fields: SettingsField[] }[] = [
  { legend: "w-20", fields: ["choice", "text", "text"] },
  { legend: "w-16", fields: ["choice", "choice"] },
];

/** The verification's shape while it loads: the status note and the first sections of the form. */
export function KybSkeleton() {
  return (
    <div
      className="flex max-w-2xl flex-col gap-6 pb-6"
      role="status"
      aria-busy="true"
      aria-label="Loading verification"
    >
      <Skeleton className="h-22 w-full rounded-lg" />
      <div className="flex flex-col gap-8">
        {SECTIONS.map((section) => (
          <div key={section.legend} className="flex flex-col gap-6">
            <Skeleton className={`h-6 ${section.legend}`} />
            <div className="flex flex-col gap-7">
              {section.fields.map((field, index) => (
                <FieldSkeleton key={index} field={field} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
