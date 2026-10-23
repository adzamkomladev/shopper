import * as v from "valibot";
import { ID_TYPES } from "../../lib/kyc/ids";

export const idTypeSchema = v.picklist(ID_TYPES);

export const kycSettingsView = v.object({
  idRequired: v.boolean(),
  idTypes: v.array(idTypeSchema),
});
export type KycSettingsView = v.InferOutput<typeof kycSettingsView>;

export const kycSettingsFormSchema = v.object({
  idRequired: v.boolean(),
  idTypes: v.pipe(v.array(idTypeSchema), v.minLength(1, "Accept at least one type of ID")),
});
export type KycSettingsValues = v.InferInput<typeof kycSettingsFormSchema>;
