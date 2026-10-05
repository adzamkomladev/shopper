import { eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, type CommandContext } from "../packages/core/src/index";
import {
  org,
  shopperMeta,
  taxClass,
  taxRule,
  type ShopperDatabase,
} from "../packages/db-pg/src/index";
import { ghana2026 } from "../packages/tax/src/index";
import { buildDefines } from "./build-info";

export const provisionOrg = defineCommand({
  name: "org.provision",
  async run(tx, context, input: { name: string }) {
    await tx.insert(org).values({ id: context.orgId, name: input.name });
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
      schemaVersion: Number(buildDefines.SCHEMA_VERSION),
      syncProtocol: Number(buildDefines.SYNC_PROTOCOL),
      archiveFormat: Number(buildDefines.ARCHIVE_FORMAT),
    });
    return { id: context.orgId };
  },
  audit: (input, output) => ({
    name: input.name,
    orgId: output.id,
    taxEffectiveFrom: ghana2026.effectiveFrom,
  }),
});
export function provisioningContext(orgId = v7()): CommandContext {
  return { orgId, appVersion: JSON.parse(buildDefines.SHOPPER_VERSION) as string };
}
export async function seedDevelopment(db: ShopperDatabase) {
  // Serialize provisioning, including the existence check, across concurrent CLI runs.
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('shopper.dev.seed', 0))`);
    const [existing] = await tx.select().from(org).where(eq(org.name, "Shopper development"));
    if (existing) return { id: existing.id, created: false };
    const context = provisioningContext();
    const result = await provisionOrg(tx, context, { name: "Shopper development" });
    return { ...result, created: true };
  });
}
