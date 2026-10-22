import { and, eq, sql } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { accountHold, customer, type ShopperTransaction } from "@shopper/db-pg";
import {
  customerFields,
  customerInput,
  customerPatch,
  type CustomerFields,
  type CustomerInput,
} from "../schemas/customers/inputs";
import { CustomerError } from "./error";
import { publishCustomer } from "./feed";
import { readCustomerRow } from "./queries";

type Saved = { id: string; replayed: boolean };

/** The fields a user edits, in one fixed shape for audit and comparison. */
const fieldsOf = (row: CustomerFields) => ({
  name: row.name,
  phone: row.phone,
  kind: row.kind,
  businessName: row.businessName ?? null,
  tin: row.tin ?? null,
  email: row.email ?? null,
});

/** A customer keyed by the client's UUIDv7; the same id with the same content replays, other content is a CONFLICT. */
/** The create already saved under this id: its replay output, undefined when none, CONFLICT when the content differs. */
async function savedCreate(tx: ShopperTransaction, orgId: string, next: CustomerInput) {
  const [saved] = await tx
    .select()
    .from(customer)
    .where(and(eq(customer.orgId, orgId), eq(customer.id, next.id)));
  if (!saved) return undefined;
  // ponytail: once edited the original content is gone, so a retry is taken as the same create.
  if (saved.version === 1 && JSON.stringify(fieldsOf(saved)) !== JSON.stringify(fieldsOf(next)))
    throw new CustomerError("CONFLICT", "Customer identity already has different content");
  return { id: next.id, replayed: true };
}

export const createCustomer = defineCommand({
  name: "customer.create",
  async replay(tx, ctx, input: { customer: unknown }) {
    const output = await savedCreate(tx, ctx.orgId, v.parse(customerInput, input.customer));
    return output && { output };
  },
  async run(tx, ctx, input: { customer: unknown }): Promise<Saved> {
    const next = v.parse(customerInput, input.customer);
    const [row] = await tx
      .insert(customer)
      .values({ ...next, orgId: ctx.orgId, createdDeviceId: ctx.deviceId })
      .onConflictDoNothing()
      .returning();
    // A concurrent create of the same id won: answer as a replay, or CONFLICT if it differs.
    if (!row) {
      const output = await savedCreate(tx, ctx.orgId, next);
      if (output) return output;
      throw new CustomerError("CONFLICT", "Customer identity already exists");
    }
    await publishCustomer(tx, ctx.orgId, row);
    return { id: next.id, replayed: false };
  },
  audit: (input, output) => ({
    id: output.id,
    ...fieldsOf(v.parse(customerInput, input.customer)),
  }),
  details: (input, output) => ({
    entity: "customer",
    entityId: output.id,
    after: fieldsOf(v.parse(customerInput, input.customer)),
  }),
});

/** Edits name, phone, kind, business name, TIN or email; the result must still be a valid customer. */
export const updateCustomer = defineCommand({
  name: "customer.update",
  async run(tx, ctx, input: { id: string; patch: unknown }) {
    const patch = v.parse(customerPatch, input.patch);
    const current = await readCustomerRow(tx, ctx.orgId, input.id, true);
    const next = v.parse(customerFields, { ...fieldsOf(current), ...patch });
    const [row] = await tx
      .update(customer)
      .set({ ...next, version: sql`${customer.version} + 1`, updatedAt: new Date() })
      .where(and(eq(customer.orgId, ctx.orgId), eq(customer.id, current.id)))
      .returning();
    await publishCustomer(tx, ctx.orgId, row!);
    return {
      id: current.id,
      before: fieldsOf(current),
      after: fieldsOf(row!),
      version: row!.version,
    };
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({
    entity: "customer",
    entityId: output.id,
    before: output.before,
    after: output.after,
  }),
});

async function setArchived(
  tx: ShopperTransaction,
  orgId: string,
  id: string,
  archivedAt: Date | null,
) {
  const [row] = await tx
    .update(customer)
    .set({ archivedAt, version: sql`${customer.version} + 1`, updatedAt: new Date() })
    .where(and(eq(customer.orgId, orgId), eq(customer.id, id)))
    .returning();
  await publishCustomer(tx, orgId, row!);
  return { id };
}

type Archive = { id: string; now: Date };

/** Takes a settled customer off the till. Refused while they owe, are owed, hold points or have an open hold. */
export const archiveCustomer = defineCommand({
  name: "customer.archive",
  async replay(tx, ctx, input: Archive) {
    const current = await readCustomerRow(tx, ctx.orgId, input.id);
    return current.archivedAt ? { output: { id: current.id } } : undefined;
  },
  async run(tx, ctx, input: Archive) {
    const current = await readCustomerRow(tx, ctx.orgId, input.id, true);
    if (current.balance !== 0)
      throw new CustomerError("BALANCE_NOT_ZERO", "The customer's account is not settled");
    if (current.points !== 0)
      throw new CustomerError("POINTS_NOT_ZERO", "The customer still holds points");
    // ponytail: any held row blocks, even past its hour; the hold sweep of the credit slice releases stale ones.
    const [open] = await tx
      .select({ id: accountHold.id })
      .from(accountHold)
      .where(
        and(
          eq(accountHold.orgId, ctx.orgId),
          eq(accountHold.customerId, current.id),
          eq(accountHold.status, "held"),
        ),
      )
      .limit(1);
    if (open) throw new CustomerError("HOLDS_OPEN", "The customer has an open hold");
    return setArchived(tx, ctx.orgId, current.id, input.now);
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({ entity: "customer", entityId: output.id }),
});

/** Brings an archived customer back to the till. A merged customer stays merged. */
export const unarchiveCustomer = defineCommand({
  name: "customer.unarchive",
  async replay(tx, ctx, input: { id: string }) {
    const current = await readCustomerRow(tx, ctx.orgId, input.id);
    return current.archivedAt ? undefined : { output: { id: current.id } };
  },
  async run(tx, ctx, input: { id: string }) {
    const current = await readCustomerRow(tx, ctx.orgId, input.id, true);
    if (current.mergedIntoId)
      throw new CustomerError("MERGED", "A merged customer cannot be restored");
    return setArchived(tx, ctx.orgId, current.id, null);
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({ entity: "customer", entityId: output.id }),
});
