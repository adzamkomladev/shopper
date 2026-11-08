import { defineCommand } from "@shopper/audit";
import { buildInfo } from "@shopper/config";
import { provisionOrg } from "@shopper/core";
import { mutateManagement } from "@shopper/core/management";
import { createVerifiedOwner } from "../onboarding/owner";

/** A box's first boot: its shop, first store and owner, in one transaction and one audit entry. */
export const installBox = defineCommand({
  name: "box.install",
  async run(
    tx,
    context,
    input: {
      shop: { name: string; code: string };
      store: { name: string };
      owner: { name: string; email: string; password: string };
    },
  ) {
    await provisionOrg(tx, context, {
      name: input.shop.name,
      slug: input.shop.code,
      metadata: buildInfo,
    });
    await createVerifiedOwner(tx, context, input.owner);
    await mutateManagement(tx, context, {
      kind: "store",
      action: "create",
      data: { name: input.store.name },
    });
    return { orgId: context.orgId, shopCode: input.shop.code, email: input.owner.email };
  },
  audit: (_input, result) => ({ orgId: result.orgId, shopCode: result.shopCode }),
});
