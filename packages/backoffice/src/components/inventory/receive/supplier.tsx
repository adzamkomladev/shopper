import { Button } from "@shopper/ui/components/button";
import { Field, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { Kbd } from "@shopper/ui/components/kbd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shopper/ui/components/select";
import { entryId } from "../../../lib/inventory/entry";
import type { Chosen } from "../../../lib/inventory/types";

type Props = {
  suppliers: Chosen[];
  value: Chosen | null;
  onChange: (supplier: Chosen) => void;
  /** Opens the new supplier sheet. */
  onAdd: () => void;
  addRef: React.Ref<HTMLButtonElement>;
  error?: string;
};

/** Who the goods came from: one of the shop's suppliers, or a new one added on the spot. */
export function SupplierField({ suppliers, value, onChange, onAdd, addRef, error }: Props) {
  const id = entryId("supplierId");
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>Supplier</FieldLabel>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          value={value?.id ?? ""}
          onValueChange={(picked) =>
            onChange(suppliers.find((supplier) => supplier.id === picked)!)
          }
        >
          <SelectTrigger
            id={id}
            className="w-full min-w-0 sm:flex-1"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
          >
            {/* The name is shown from our own state, so a supplier just added reads before the list refetches. */}
            <SelectValue placeholder="Choose a supplier">{value?.name}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {suppliers.length === 0 && (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                No suppliers yet. Add the first one.
              </p>
            )}
            {suppliers.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button ref={addRef} type="button" variant="outline" onClick={onAdd}>
          Add supplier
          <Kbd aria-hidden className="max-sm:hidden">
            S
          </Kbd>
        </Button>
      </div>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}
