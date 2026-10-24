import * as v from "valibot";
import { ghanaPhone } from "@shopper/core/schemas";
import { fromDecimal, money, toDecimal } from "@shopper/money";
import { ID_TYPES, isValidId } from "../lib/kyc/ids";
import { amountField } from "./settings/fields";
import { idTypeSchema } from "./settings/kyc";

export const KYC_STATUSES = [
  "otp_sent",
  "id_needed",
  "review",
  "approved",
  "rejected",
  "expired",
] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

const count = v.pipe(v.number(), v.safeInteger());

/** A case as the API shows it: the ID number is never here, only its mask. */
export const kycCase = v.object({
  id: v.string(),
  purpose: v.picklist(["credit", "role"]),
  status: v.picklist(KYC_STATUSES),
  customerId: v.nullable(v.string()),
  memberId: v.nullable(v.string()),
  phone: v.string(),
  requestedLimit: v.nullable(count),
  requestedRoleId: v.nullable(v.string()),
  idType: v.nullable(idTypeSchema),
  idMasked: v.nullable(v.string()),
  fullName: v.nullable(v.string()),
  idSighted: v.boolean(),
  approvedLimit: v.nullable(count),
  approvedRoleId: v.nullable(v.string()),
  decisionNote: v.nullable(v.string()),
  decidedAt: v.nullable(v.string()),
  decisionDueAt: v.nullable(v.string()),
  createdAt: v.string(),
});
export type KycCase = v.InferOutput<typeof kycCase>;

export const kycList = v.object({ items: v.array(kycCase) });

/** A case with the other subjects' cases that carry the same ID fingerprint. */
export const kycDetail = v.object({
  ...kycCase.entries,
  duplicates: v.array(
    v.object({
      caseId: v.string(),
      customerId: v.nullable(v.string()),
      memberId: v.nullable(v.string()),
    }),
  ),
});
export type KycDetail = v.InferOutput<typeof kycDetail>;

/** The few fields of a customer the review and the start sheet need. */
export const subjectCustomer = v.object({ id: v.string(), name: v.string(), phone: v.string() });
export const subjectCustomers = v.object({ items: v.array(subjectCustomer) });
export type SubjectCustomer = v.InferOutput<typeof subjectCustomer>;

const PHONE_ERROR = "Enter a Ghana mobile number like 024 123 4567";
const phone = v.pipe(
  v.string(),
  v.trim(),
  v.check((text) => v.is(ghanaPhone, text), PHONE_ERROR),
);
const limit = amountField(1, "Enter an amount above zero, like 500.00");

export const startFormSchema = v.object({
  customerId: v.pipe(v.string(), v.nonEmpty("Choose a customer")),
  phone,
  limit,
});
export type StartValues = v.InferInput<typeof startFormSchema>;

/** A role check needs the role instead of a limit; the member is fixed by the caller. */
export const startRoleFormSchema = v.object({
  roleId: v.pipe(v.string(), v.nonEmpty("Choose a role")),
  phone,
});
export type StartRoleValues = v.InferInput<typeof startRoleFormSchema>;

export const otpFormSchema = v.object({
  code: v.pipe(
    v.string(),
    v.trim(),
    v.regex(/^\d{6}$/, "Enter the 6 digits from the text message"),
  ),
});

export const idFormSchema = v.pipe(
  v.object({
    idType: v.picklist(ID_TYPES, "Choose the type of ID"),
    idNumber: v.pipe(v.string(), v.trim(), v.nonEmpty("Enter the ID number")),
    fullName: v.pipe(v.string(), v.trim(), v.nonEmpty("Enter the name on the ID")),
  }),
  v.forward(
    v.check(
      ({ idType, idNumber }) => isValidId(idType, idNumber),
      "Not a valid number for this ID type",
    ),
    ["idNumber"],
  ),
);
export type IdValues = { idType: string; idNumber: string; fullName: string };

export const limitText = (amount: number | null) => (amount ? toDecimal(money(amount)) : "");
export const toStartBody = (values: StartValues) => ({
  purpose: "credit" as const,
  subject: { customerId: values.customerId },
  requestedLimit: fromDecimal(values.limit.trim()),
  phone: values.phone.trim(),
});
export const toRoleStartBody = (userId: string, values: StartRoleValues) => ({
  purpose: "role" as const,
  subject: { userId },
  requestedRoleId: values.roleId,
  phone: values.phone.trim(),
});

const note = v.pipe(v.string(), v.trim(), v.maxLength(500, "Use 500 characters or fewer"));
const decisionFields = { sighted: v.boolean(), limit: v.string(), roleId: v.string() };

/** Approving: a credit check needs the limit, and an ID on the case needs the approver to have seen it. */
export const approveSchema = (credit: boolean, hasId: boolean) =>
  v.object({
    ...decisionFields,
    sighted: hasId ? v.literal(true, "Confirm you sighted the ID document") : v.boolean(),
    limit: credit ? limit : v.string(),
    note,
  });

export const rejectSchema = v.object({
  ...decisionFields,
  note: v.pipe(note, v.minLength(1, "Say why you are rejecting this check")),
});
export type DecisionValues = v.InferInput<typeof rejectSchema>;

/** The body of a decision. An approval needs a note on the wire, so it gets one when the approver wrote none. */
export function toDecisionBody(
  approve: boolean,
  credit: boolean,
  values: DecisionValues,
  hasId: boolean,
) {
  if (!approve) return { approve, note: values.note.trim() };
  return {
    approve,
    note: values.note.trim() || "Approved",
    idSighted: hasId ? values.sighted : undefined,
    ...(credit
      ? { limit: fromDecimal(values.limit.trim()) }
      : values.roleId
        ? { roleId: values.roleId }
        : {}),
  };
}

/** The queue's view; it defaults to the one that needs someone to act. */
export const kycQueueSearch = v.object({
  segment: v.optional(v.fallback(v.picklist(["review", "open", "closed"]), "review"), "review"),
});
