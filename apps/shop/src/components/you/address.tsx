import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@shopper/ui/components/button";
import { Checkbox } from "@shopper/ui/components/checkbox";
import { Field, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input";
import { toast } from "@shopper/ui/components/sonner";
import { Loader2 } from "lucide-react";
import { shopFetch } from "../../queries/api";
import { shopAddress, type ShopAddress } from "../../schemas/shop";

const FIELDS = [
  { name: "label", label: "Name it", placeholder: "Home", autoComplete: "off" },
  {
    name: "line1",
    label: "Street or house",
    placeholder: "12 Oxford Street",
    autoComplete: "address-line1",
  },
  { name: "area", label: "Area", placeholder: "Osu", autoComplete: "address-level3" },
  { name: "city", label: "Town or city", placeholder: "Accra", autoComplete: "address-level2" },
  {
    name: "landmark",
    label: "Landmark (optional)",
    placeholder: "Opposite the bank",
    autoComplete: "off",
  },
  {
    name: "phone",
    label: "Phone for the rider",
    placeholder: "024 123 4567",
    autoComplete: "tel-national",
  },
] as const;

type Draft = Record<(typeof FIELDS)[number]["name"], string> & { isDefault: boolean };

/** Adds an address, or edits one in place; the server checks every field and says what to fix. */
export function AddressForm({
  phone,
  address,
  onDone,
  onCancel,
}: {
  phone: string;
  address?: ShopAddress;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => ({
    label: address?.label ?? "",
    line1: address?.line1 ?? "",
    area: address?.area ?? "",
    city: address?.city ?? "",
    landmark: address?.landmark ?? "",
    phone: address?.phone ?? phone,
    isDefault: address?.isDefault ?? false,
  }));
  const save = useMutation({
    mutationFn: () =>
      shopFetch(address ? `/account/addresses/${address.id}` : "/account/addresses", shopAddress, {
        method: address ? "PATCH" : "POST",
        body: { ...draft, landmark: draft.landmark || null },
      }),
    onSuccess: () => {
      toast.success(address ? "Address saved" : "Address added");
      onDone();
    },
  });
  return (
    <form
      className="animate-rise space-y-3 rounded-2xl border-2 border-primary/30 bg-card p-4"
      aria-label={address ? `Edit ${address.label}` : "New address"}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {FIELDS.map((field, index) => (
        <Field key={field.name}>
          <FieldLabel htmlFor={`address-${field.name}`}>{field.label}</FieldLabel>
          <Input
            id={`address-${field.name}`}
            autoFocus={index === 0}
            autoComplete={field.autoComplete}
            placeholder={field.placeholder}
            inputMode={field.name === "phone" ? "tel" : undefined}
            value={draft[field.name]}
            onChange={(event) => setDraft({ ...draft, [field.name]: event.target.value })}
            className="h-11 rounded-xl px-3 text-base"
          />
        </Field>
      ))}
      <label className="flex items-center gap-3 py-1 text-sm font-medium">
        <Checkbox
          checked={draft.isDefault}
          onCheckedChange={(checked) => setDraft({ ...draft, isDefault: checked === true })}
        />
        Use this address by default
      </label>
      <FieldError>{save.error?.message}</FieldError>
      <div className="flex gap-2">
        <Button
          type="submit"
          className="h-11 flex-1 rounded-xl font-semibold"
          disabled={save.isPending}
        >
          {save.isPending ? <Loader2 aria-hidden className="animate-spin" /> : null}
          {address ? "Save address" : "Add address"}
        </Button>
        <Button type="button" variant="ghost" className="h-11 rounded-xl" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
