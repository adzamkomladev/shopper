import { useQuery } from "@tanstack/react-query";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@shopper/ui/components/field";
import { Switch } from "@shopper/ui/components/switch";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { useShareOnline } from "../../../queries/customers/online";
import type { CustomerView } from "../../../queries/customers/types";
import { onlineSettingsQuery } from "../../../queries/settings/online";

/**
 * On a box that sells online (v1.5 Day 51): whether this customer agreed to see their receipts and points in the
 * online store. Only customers switched on here leave the box. Nothing shows elsewhere.
 */
export function CustomerOnline({
  customer,
  canEdit,
}: {
  customer: CustomerView;
  canEdit: boolean;
}) {
  const settings = useQuery(onlineSettingsQuery()).data;
  const online = useOnline();
  const share = useShareOnline(customer.id);
  if (!settings?.box || !settings.onlineOrders || customer.archivedAt) return null;
  const checked = share.isPending ? share.variables : customer.onlineShared;
  return (
    <Field orientation="horizontal" className="rounded-lg border bg-card p-4 shadow-sm">
      <Switch
        id="customer-online"
        checked={checked}
        disabled={!canEdit || !online || share.isPending}
        aria-describedby="customer-online-hint"
        onCheckedChange={(next) => share.mutate(next)}
      />
      <FieldContent>
        <FieldLabel htmlFor="customer-online">Show receipts and points online</FieldLabel>
        <FieldDescription id="customer-online-hint">
          {checked
            ? "Their receipts and points show in your online store's account page."
            : "Their receipts and points stay on this box."}
        </FieldDescription>
      </FieldContent>
    </Field>
  );
}
