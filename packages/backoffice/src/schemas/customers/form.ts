import * as v from "valibot";
import { compactPhone, customerInput, customerPatch, tinSchema } from "@shopper/core/schemas";
import type { CustomerView } from "../../queries/customers/types";

const optional = (max: number) => v.pipe(v.string(), v.trim(), v.maxLength(max, "Keep it shorter"));

/** The form as typed: what the till would accept, with a plain message on each field. */
export const customerFormSchema = v.pipe(
  v.object({
    name: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1, "Enter a name"),
      v.maxLength(200, "Keep it shorter"),
    ),
    phone: v.pipe(
      v.string(),
      v.transform(compactPhone),
      v.regex(/^(?:0\d{9}|\+?233\d{9})$/, "Enter a Ghana mobile number, like 024 123 4567"),
    ),
    kind: v.picklist(["individual", "business"]),
    businessName: optional(200),
    tin: v.pipe(
      v.string(),
      v.trim(),
      v.toUpperCase(),
      v.check(
        (tin) => tin === "" || v.is(tinSchema, tin),
        "Enter the TIN as GRA prints it, like C0012345678",
      ),
    ),
    email: v.pipe(
      optional(200),
      v.check(
        (email) => email === "" || v.is(v.pipe(v.string(), v.email()), email),
        "Enter an email address",
      ),
    ),
  }),
  v.forward(
    v.check(
      (c) => c.kind !== "business" || c.businessName !== "",
      "A business needs a business name",
    ),
    ["businessName"],
  ),
);
export type CustomerValues = v.InferInput<typeof customerFormSchema>;

export const emptyCustomer: CustomerValues = {
  name: "",
  phone: "",
  kind: "individual",
  businessName: "",
  tin: "",
  email: "",
};

export const customerValues = (customer: CustomerView): CustomerValues => ({
  name: customer.name,
  phone: customer.phone,
  kind: customer.kind,
  businessName: customer.businessName ?? "",
  tin: customer.tin ?? "",
  email: customer.email ?? "",
});

// A cleared optional field is sent as null, which removes it.
const orNull = (text: string) => text.trim() || null;

function fields(values: CustomerValues) {
  return {
    name: values.name,
    phone: compactPhone(values.phone),
    kind: values.kind,
    businessName: values.kind === "business" ? orNull(values.businessName) : null,
    tin: orNull(values.tin.toUpperCase()),
    email: orNull(values.email),
  };
}

/** The body of a create, keyed by the client's UUIDv7 so a retry replays instead of doubling. */
export const toCreateBody = (id: string, values: CustomerValues) =>
  v.parse(customerInput, { id, ...fields(values) });

export const toPatchBody = (values: CustomerValues) => v.parse(customerPatch, fields(values));
