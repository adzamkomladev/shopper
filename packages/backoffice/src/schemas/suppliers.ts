import * as v from "valibot";
import { supplierInput, supplierView } from "@shopper/core/schemas";

export const supplierList = v.array(supplierView);
export type SupplierView = v.InferOutput<typeof supplierView>;

const { name } = supplierInput.entries;
const contact = v.pipe(v.string(), v.trim(), v.maxLength(200));
export const supplierFormSchema = v.object({ name, phone: contact, email: contact, tin: contact });
export type SupplierValues = v.InferInput<typeof supplierFormSchema>;

export const emptySupplier: SupplierValues = { name: "", phone: "", email: "", tin: "" };
export const supplierValues = (supplier: SupplierView): SupplierValues => ({
  name: supplier.name,
  phone: supplier.phone ?? "",
  email: supplier.email ?? "",
  tin: supplier.tin ?? "",
});

// A cleared contact is sent as null, which removes it; an untouched one is sent as it is.
const orNull = (text: string) => text.trim() || null;
export function toSupplierBody(values: SupplierValues) {
  return v.parse(supplierInput, {
    name: values.name,
    phone: orNull(values.phone),
    email: orNull(values.email),
    tin: orNull(values.tin),
  });
}
