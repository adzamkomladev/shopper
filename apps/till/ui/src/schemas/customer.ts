import * as v from "valibot";
import { compactPhone, editableCustomerFields, tinSchema } from "@shopper/core/schemas";
import type { CustomerFields } from "../sale/customer/types";

/** What the form holds: every field is text until it is checked. */
export type CustomerDraft = {
  phone: string;
  name: string;
  kind: CustomerFields["kind"];
  businessName: string;
  tin: string;
};
export type CustomerField = "phone" | "name" | "businessName" | "tin";
export type Problems = Partial<Record<CustomerField, string>>;

const messages = {
  phone: "Enter a Ghana mobile number, like 024 123 4567",
  name: "Enter the customer's name",
  businessName: "Enter the business name",
  tin: "A TIN is a letter and ten digits, like C0012345678",
  tinRequired: "Enter the TIN to print on the invoice",
} as const;

/** The number as the register stores it (0XXXXXXXXX), or undefined when it is not a Ghana mobile number. */
export function normalPhone(text: string) {
  const parsed = v.safeParse(editableCustomerFields.phone, compactPhone(text));
  return parsed.success ? parsed.output : undefined;
}

/** A TIN is typed in either case; the register keeps it as GRA prints it. */
const normalTin = (text: string) => text.trim().toUpperCase();

export const phoneProblem = (text: string) => (normalPhone(text) ? undefined : messages.phone);

/** A business shows its TIN; so does an invoice, which needs it, and a customer who already has one. */
export const showsTin = (draft: CustomerDraft, invoice: boolean, hadTin: boolean) =>
  draft.kind === "business" || invoice || hadTin;

/** Why the form cannot be saved yet, one message per field; empty when it can. `invoice` makes the TIN required. */
export function problemsOf(draft: CustomerDraft, invoice: boolean, tinShown: boolean): Problems {
  const problems: Problems = {};
  const phone = phoneProblem(draft.phone);
  if (phone) problems.phone = phone;
  if (!draft.name.trim()) problems.name = messages.name;
  if (draft.kind === "business" && !draft.businessName.trim())
    problems.businessName = messages.businessName;
  const tin = normalTin(draft.tin);
  if (!tinShown) return problems;
  if (tin && !v.is(tinSchema, tin)) problems.tin = messages.tin;
  else if (!tin && invoice) problems.tin = messages.tinRequired;
  return problems;
}

/** The checked fields in the shape the register takes. Call only when `problemsOf` found nothing. */
export function fieldsOf(draft: CustomerDraft, tinShown: boolean): CustomerFields {
  const business = draft.kind === "business";
  return {
    name: draft.name.trim(),
    phone: normalPhone(draft.phone)!,
    kind: draft.kind,
    businessName: business ? draft.businessName.trim() : null,
    // A field the cashier cannot see is not sent, whatever it held before the type changed.
    tin: (tinShown && normalTin(draft.tin)) || null,
  };
}

export const draftOf = (customer: CustomerFields): CustomerDraft => ({
  phone: customer.phone,
  name: customer.name,
  kind: customer.kind,
  businessName: customer.businessName ?? "",
  tin: customer.tin ?? "",
});
