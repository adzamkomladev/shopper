import * as v from "valibot";

const day = v.nullable(v.string());
export const documentKinds = ["registration_certificate", "tin_certificate"] as const;

export const kybDirector = v.object({
  name: v.string(),
  ghanaCard: v.string(),
  cardExpiresOn: v.string(),
  cardAssetId: v.string(),
});

/** The shop's verification as the API reads it; a shop that never started one reads as an empty draft. */
export const kybView = v.object({
  status: v.picklist([
    "draft",
    "submitted",
    "checks_failed",
    "in_review",
    "approved",
    "rejected",
    "expired",
  ]),
  version: v.number(),
  businessName: v.nullable(v.string()),
  registrationNumber: v.nullable(v.string()),
  tin: v.nullable(v.string()),
  settlementBank: v.nullable(v.string()),
  settlementAccount: v.nullable(v.string()),
  directors: v.array(kybDirector),
  documents: v.array(
    v.object({ kind: v.picklist(documentKinds), assetId: v.string(), expiresOn: day }),
  ),
  checks: v.array(v.object({ check: v.string(), ok: v.boolean(), reason: v.optional(v.string()) })),
  submittedAt: day,
  decisionNote: day,
  decidedAt: day,
  expiresOn: day,
  payouts: v.boolean(),
});
export type KybView = v.InferOutput<typeof kybView>;
export type KybStatus = KybView["status"];
export type DocumentKind = (typeof documentKinds)[number];

export const kybBanks = v.array(v.object({ name: v.string(), code: v.string(), type: v.string() }));

const required = (message: string) => v.pipe(v.string(), v.trim(), v.minLength(1, message));

/** What submitting needs, so a missing field is pointed at before the request; the checks judge the formats. */
export const kybFormSchema = v.object({
  businessName: required("Enter the registered business name"),
  registrationNumber: required("Enter the registration number"),
  tin: required("Enter the business TIN"),
  settlementBank: required("Choose where payouts go"),
  settlementAccount: v.pipe(
    required("Enter the account or wallet number"),
    v.regex(/^\d+$/, "Account numbers are digits only"),
  ),
  directors: v.pipe(
    v.array(
      v.object({
        name: required("Enter the director's name"),
        ghanaCard: required("Enter the Ghana Card number"),
        cardExpiresOn: required("Enter when the card expires"),
        cardAssetId: required("Upload a scan of the card"),
      }),
    ),
    v.minLength(1, "Add at least one director"),
  ),
  registration_certificate: v.object({
    assetId: required("Upload the registration certificate"),
    expiresOn: v.string(),
  }),
  tin_certificate: v.object({
    assetId: required("Upload the TIN certificate"),
    expiresOn: v.string(),
  }),
});
export type KybValues = v.InferInput<typeof kybFormSchema>;
