import { eq } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { org } from "@shopper/db-pg";
import { assertHasPermission } from "../roles/service";
import type { kycSettingsInput } from "../schemas/kyc";

/** Whether a credit case needs an ID document, and which ID types an approver will accept. */
export const setKycSettings = defineCommand({
  name: "kyc.settings.set",
  async run(tx, context, input: v.InferOutput<typeof kycSettingsInput>) {
    await assertHasPermission(tx, context, "customer.manage");
    await tx
      .update(org)
      .set({ kycIdRequired: input.idRequired, kycIdTypes: input.idTypes, updatedAt: new Date() })
      .where(eq(org.id, context.orgId));
    return input;
  },
  audit: (_input, output) => ({ ...output }),
  details: () => ({ entity: "org" }),
});
