import * as v from "valibot";
import { QUEUE_TABS } from "../lib/kyb/status";

export const kybStatuses = [
  "draft",
  "submitted",
  "checks_failed",
  "in_review",
  "approved",
  "rejected",
  "expired",
] as const;
const status = v.picklist(kybStatuses);
const day = v.nullable(v.string());
// A short-lived link to a scan; the decision's answer and a host without object storage carry none.
const scan = v.optional(v.nullable(v.string()), null);

export const platformOrg = v.object({
  id: v.string(),
  name: v.string(),
  slug: v.nullable(v.string()),
});

export const queueItem = v.object({
  orgId: v.string(),
  shop: v.string(),
  businessName: v.nullable(v.string()),
  status,
  version: v.number(),
  submittedAt: day,
  expiresOn: day,
  payouts: v.boolean(),
});
export const queue = v.array(queueItem);

const check = v.object({ check: v.string(), ok: v.boolean(), reason: v.optional(v.string()) });
export const kybCase = v.object({
  orgId: v.string(),
  shop: v.string(),
  code: v.nullable(v.string()),
  status,
  version: v.number(),
  businessName: v.nullable(v.string()),
  registrationNumber: v.nullable(v.string()),
  tin: v.nullable(v.string()),
  settlementBank: v.nullable(v.string()),
  settlementAccount: v.nullable(v.string()),
  directors: v.array(
    v.object({
      name: v.string(),
      ghanaCard: v.string(),
      cardExpiresOn: v.string(),
      link: scan,
    }),
  ),
  documents: v.array(v.object({ kind: v.string(), expiresOn: v.nullable(v.string()), link: scan })),
  checks: v.array(check),
  submittedAt: day,
  decidedAt: day,
  decisionNote: v.nullable(v.string()),
  expiresOn: day,
  payouts: v.boolean(),
});

export const tenants = v.array(
  v.object({
    id: v.string(),
    name: v.string(),
    code: v.nullable(v.string()),
    createdAt: v.string(),
    onboarding: v.nullable(v.picklist(["setup", "trading"])),
    firstSaleAt: day,
    kybStatus: v.nullable(status),
    payouts: v.boolean(),
  }),
);

/** The queue's tab, kept in the address. */
export const queueSearch = v.object({
  status: v.optional(v.picklist(QUEUE_TABS), "in_review"),
});

/** An approval's note is optional; a rejection tells the shop what to fix. */
export const approvalNote = v.object({ note: v.string() });
export const decisionNote = v.object({
  note: v.pipe(v.string(), v.trim(), v.minLength(1, "Say what the shop must fix")),
});
