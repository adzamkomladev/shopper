import { and, eq, isNull } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { onboarding, type ShopperTransaction } from "@shopper/db-pg";
import { ManagementError } from "../management";
import { markOnboarding } from "./records";

/** The owner has no products yet and moves on: the Products step counts as done, as an import would make it. */
export const skipSetupProducts = defineCommand({
  name: "onboarding.setup.skip",
  async run(tx, context: CommandContext) {
    await requireOnboarding(tx, context.orgId);
    return { step: "products", marked: await markOnboarding(tx, context.orgId, "catalogue") };
  },
  audit: (_input, output) => output,
});

/** The owner reached the wizard's end. */
export const finishSetup = defineCommand({
  name: "onboarding.setup.finish",
  run: (tx, context: CommandContext) => stamp(tx, context.orgId, "wizardDoneAt"),
  audit: (_input, output) => output,
});

/** The owner left the wizard before its end; the shell keeps a way back until the first sale. */
export const dismissSetup = defineCommand({
  name: "onboarding.setup.dismiss",
  run: (tx, context: CommandContext) => stamp(tx, context.orgId, "wizardSkippedAt"),
  audit: (_input, output) => output,
});

// The first time counts; a second finish or dismiss changes nothing.
async function stamp(
  tx: ShopperTransaction,
  orgId: string,
  column: "wizardDoneAt" | "wizardSkippedAt",
) {
  await requireOnboarding(tx, orgId);
  const at = new Date();
  const [row] = await tx
    .update(onboarding)
    .set({ [column]: at, updatedAt: at })
    .where(and(eq(onboarding.orgId, orgId), isNull(onboarding[column])))
    .returning({ id: onboarding.id });
  return { [column]: Boolean(row) };
}

// A box, or a shop made before onboarding was tracked, has no wizard to move through.
async function requireOnboarding(tx: ShopperTransaction, orgId: string) {
  const [row] = await tx
    .select({ id: onboarding.id })
    .from(onboarding)
    .where(eq(onboarding.orgId, orgId))
    .for("update");
  if (!row) throw new ManagementError("This shop has no setup to change", 404);
}
