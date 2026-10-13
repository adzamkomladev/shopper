import { defineCommand } from "@shopper/audit";
import { org, shopperMeta, taxClass, taxRule } from "@shopper/db-pg";
import { ghana2026 } from "@shopper/tax";

export const provisionOrg = defineCommand({
  name: "org.provision",
  async run(
    tx,
    context,
    input: {
      name: string;
      slug?: string;
      metadata: { schemaVersion: number; syncProtocol: number; archiveFormat: number };
    },
  ) {
    await tx
      .insert(org)
      .values({ id: context.orgId, name: input.name, slug: input.slug?.trim().toLowerCase() });
    await tx.insert(taxClass).values([
      { orgId: context.orgId, code: "standard", name: "Standard" },
      { orgId: context.orgId, code: "zero-rated", name: "Zero-rated" },
      { orgId: context.orgId, code: "exempt", name: "Exempt" },
    ]);
    await tx.insert(taxRule).values({ orgId: context.orgId, ...ghana2026 });
    await tx.insert(shopperMeta).values({
      orgId: context.orgId,
      productVersion: context.appVersion,
      event: "install",
      schemaVersion: input.metadata.schemaVersion,
      syncProtocol: input.metadata.syncProtocol,
      archiveFormat: input.metadata.archiveFormat,
    });
    return { id: context.orgId };
  },
  audit: (input, output) => ({
    name: input.name,
    orgId: output.id,
    taxEffectiveFrom: ghana2026.effectiveFrom,
  }),
});
