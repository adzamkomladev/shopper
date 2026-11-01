import { Skeleton } from "@shopper/ui/components/skeleton";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@shopper/ui/components/field";
import { PaymentsPage } from "../page";

/** The provider legend and its two choices, then the save button: the form's own fields with blocks in them. */
export function PaymentSettingsBodySkeleton() {
  return (
    <div
      className="flex max-w-2xl flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading payment settings"
    >
      <FieldSet className="gap-3">
        <FieldLegend variant="label">
          <Skeleton className="h-5 w-25" />
        </FieldLegend>
        <FieldDescription>
          <Skeleton className="h-5.25 w-96 max-w-full" />
        </FieldDescription>
        <div className="grid gap-3">
          {[0, 1].map((index) => (
            <Field key={index} orientation="horizontal">
              <Skeleton className="size-4 shrink-0 rounded-full" />
              <FieldContent>
                <FieldLabel>
                  <Skeleton className="h-5 w-20" />
                </FieldLabel>
                <FieldDescription>
                  <Skeleton className="h-5 w-full max-w-lg" />
                </FieldDescription>
              </FieldContent>
            </Field>
          ))}
        </div>
      </FieldSet>
      <Skeleton className="h-8 w-43" />
    </div>
  );
}

/** The payments heading and tabs around the form's skeleton, for the route's own loading. */
export function PaymentSettingsSkeleton() {
  return (
    <PaymentsPage active="settings">
      <PaymentSettingsBodySkeleton />
    </PaymentsPage>
  );
}
