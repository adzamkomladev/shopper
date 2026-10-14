import { eq, sql } from "drizzle-orm";
import { defineCommand, type CommandContext } from "../../packages/core/src/index";
import { provisionOrg as provision } from "../../packages/core/src/provisioning";
import { v7 } from "uuid";
import { buildDefines } from "../build/info";
import { runImport } from "../../packages/core/src/catalogue/index";
import { org, type ShopperDatabase } from "../../packages/db/pg/src/index";
import { generateCatalogue, toSpreadsheet } from "../lib/catalogue/fixture";

export function provisionOrg(
  db: ShopperDatabase,
  context: CommandContext,
  input: { name: string; slug?: string },
) {
  return provision(db, context, {
    ...input,
    metadata: {
      schemaVersion: Number(buildDefines.SCHEMA_VERSION),
      syncProtocol: Number(buildDefines.SYNC_PROTOCOL),
      archiveFormat: Number(buildDefines.ARCHIVE_FORMAT),
    },
  });
}
export function provisioningContext(orgId = v7()): CommandContext {
  return { orgId, appVersion: JSON.parse(buildDefines.SHOPPER_VERSION) as string };
}
const DEV_SLUG = "dev";
// A dev org seeded before shop codes existed has no slug; this gives it one so login works.
const setDevSlug = defineCommand({
  name: "org.set_slug",
  async run(tx, context, input: { slug: string }) {
    await tx.update(org).set({ slug: input.slug }).where(eq(org.id, context.orgId));
    return { id: context.orgId, slug: input.slug };
  },
  audit: (input, output) => ({ orgId: output.id, slug: input.slug }),
});
export async function seedDevelopment(db: ShopperDatabase) {
  // Serialize provisioning, including the existence check, across concurrent CLI runs.
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('shopper.dev.seed', 0))`);
    const [existing] = await tx.select().from(org).where(eq(org.name, "Shopper development"));
    if (existing) {
      if (existing.slug !== DEV_SLUG)
        await setDevSlug(tx, provisioningContext(existing.id), { slug: DEV_SLUG });
      return { id: existing.id, created: false };
    }
    const context = provisioningContext();
    const result = await provisionOrg(tx, context, { name: "Shopper development", slug: DEV_SLUG });
    return { ...result, created: true };
  });
}
// Run once, for a newly created dev org: the catalogue goes through the real import command.
export async function seedCatalogue(db: ShopperDatabase, orgId: string, count = 20_000) {
  const sheet = toSpreadsheet(generateCatalogue(count), "xlsx");
  return runImport(db, provisioningContext(orgId), sheet, "dev-catalogue.xlsx");
}
