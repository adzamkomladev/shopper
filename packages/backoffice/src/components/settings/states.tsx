import { Skeleton } from "@shopper/ui/components/skeleton";
import { CustomersPage } from "../customers/tabs";
import { SettingsPage } from "./page";
import type { SettingsField } from "./types";

/** Each page's heading and line of help, which its screen and its loading state both draw. */
export const SETTINGS_COPY = {
  loyalty: {
    description:
      "Customers earn points when they pay and spend them at the till. These rules apply to every branch.",
  },
  credit: {
    title: "Credit",
    description:
      "When a customer's balance is overdue and what it costs them. These rules apply to every customer account.",
  },
  statements: {
    title: "Statements",
    description: "Send each customer who owes money their statement on the same day every month.",
  },
  kyc: {
    title: "Identity check settings",
    description:
      "What a person must show before a customer gets credit or a staff member gets a role.",
  },
} as const;

type Props = { fields: SettingsField[]; saveWidth: string; label: string };

/** A settings form: its fields in a group, then the Save button. */
export function FormSkeleton({ fields, saveWidth, label }: Props) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="flex flex-col gap-6">
      <div className="flex flex-col gap-7">
        {fields.map((field, index) => (
          <FieldSkeleton key={index} field={field} />
        ))}
      </div>
      <Skeleton className={`h-8 ${saveWidth}`} />
    </div>
  );
}

/** A field of a settings form: label, control and help, at the sizes `Field` gives them. */
export function FieldSkeleton({ field }: { field: SettingsField }) {
  if (field === "switch" || field === "switch-note")
    return (
      <div className="flex gap-3">
        <Skeleton className="h-4.5 w-8 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-4.75 w-36" />
          <Skeleton className={field === "switch" ? "h-5.25 w-4/5" : "h-10.5 w-full"} />
        </div>
      </div>
    );
  if (field === "checks")
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-5.25 w-4/5" />
        <div className="mt-4 flex flex-col gap-3">
          {[0, 1, 2, 3].map((check) => (
            <Skeleton key={check} className="h-4.75 w-28" />
          ))}
        </div>
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4.75 w-40" />
      <Skeleton className="h-8 w-full" />
      {field === "text" && <Skeleton className="h-5.25 w-72 max-w-full" />}
    </div>
  );
}

const PAGES = {
  credit: { fields: ["text", "text"], saveWidth: "w-38.5", label: "Loading credit settings" },
  statements: {
    fields: ["choice"],
    saveWidth: "w-45.75",
    label: "Loading statement settings",
  },
  kyc: {
    fields: ["switch-note", "checks"],
    saveWidth: "w-52.25",
    label: "Loading identity check settings",
  },
} satisfies Record<string, Props>;

/** A customer settings page while its settings load: the real heading, links and help, and a form of the right shape. */
export function SettingsSkeleton({ page }: { page: keyof typeof PAGES }) {
  return (
    <SettingsPage {...SETTINGS_COPY[page]}>
      <FormSkeleton {...PAGES[page]} />
    </SettingsPage>
  );
}

/** Loyalty sits under the Customers tabs: the rules form, then the tiers section. */
export function LoyaltySkeleton() {
  return (
    <CustomersPage active="loyalty" title="Loyalty">
      <SettingsPage description={SETTINGS_COPY.loyalty.description}>
        <FormSkeleton
          fields={["switch", "text", "text", "text", "text"]}
          saveWidth="w-39.75"
          label="Loading loyalty settings"
        />
        <section aria-hidden className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-5 w-96 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-72 w-full rounded-lg" />
        </section>
      </SettingsPage>
    </CustomersPage>
  );
}
