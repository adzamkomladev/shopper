import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { ledgerAccount, org } from "@shopper/db-pg";
import { accountInput, accountPatch, ledgerId, lockInput } from "../schemas/ledger/inputs";
import { LedgerError } from "./error";

/** Adds a custom account to the org's chart; its code is unique in the org. */
export const createAccount = defineCommand({
  name: "ledger.account.create",
  async run(tx, ctx, input: { account: unknown }) {
    const account = v.parse(accountInput, input.account);
    const [saved] = await tx
      .insert(ledgerAccount)
      .values({ orgId: ctx.orgId, ...account })
      .onConflictDoNothing({ target: [ledgerAccount.orgId, ledgerAccount.code] })
      .returning();
    if (!saved) throw new LedgerError(`Account ${account.code} already exists`, 409);
    return describe(saved);
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({ entity: "ledger_account", entityId: output.id }),
});

/** Renames an account or archives a custom one; system accounts stay open because postings depend on them. */
export const updateAccount = defineCommand({
  name: "ledger.account.update",
  async run(tx, ctx, input: { id: string; patch: unknown }) {
    if (!v.is(ledgerId, input.id)) throw new LedgerError("Unknown account", 404);
    const patch = v.parse(accountPatch, input.patch);
    const [found] = await tx
      .select()
      .from(ledgerAccount)
      .where(and(eq(ledgerAccount.orgId, ctx.orgId), eq(ledgerAccount.id, input.id)));
    if (!found) throw new LedgerError("Unknown account", 404);
    if (patch.archived && found.systemKey)
      throw new LedgerError("A system account cannot be archived", 422);
    const [saved] = await tx
      .update(ledgerAccount)
      .set({
        name: patch.name ?? found.name,
        archivedAt:
          patch.archived === undefined ? found.archivedAt : patch.archived ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(ledgerAccount.orgId, ctx.orgId), eq(ledgerAccount.id, found.id)))
      .returning();
    return describe(saved!);
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({ entity: "ledger_account", entityId: output.id }),
});

/** Closes the books through a day (null reopens them): manual entries before it are refused, synced ones move past it. */
export const setLedgerLock = defineCommand({
  name: "ledger.lock",
  async run(tx, ctx, input: { body: unknown }) {
    const body = v.parse(lockInput, input.body);
    await tx.update(org).set({ ledgerLockedThrough: body.through }).where(eq(org.id, ctx.orgId));
    return { through: body.through };
  },
  audit: (_input, output) => output,
  details: () => ({ entity: "org" }),
});

export const describe = (row: typeof ledgerAccount.$inferSelect) => ({
  id: row.id,
  code: row.code,
  name: row.name,
  type: row.type,
  systemKey: row.systemKey,
  archived: row.archivedAt !== null,
});
