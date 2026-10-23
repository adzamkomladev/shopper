import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, type CommandContext } from "@shopper/audit/sqlite";
import {
  customerLookup,
  customerUpload,
  hostSession,
  saleDraft,
  type TillDatabase,
  type TillSqlite,
} from "@shopper/db-sqlite";
import { customerInput, customerFields } from "../../schemas/customers/inputs";
import { attachCustomerInput, updateTillCustomerInput } from "../../schemas/till/customers";
import { customerChanges, type CustomerEvent } from "../../schemas/customers/events";
import type { TillSession } from "../../schemas/till/session";
import { assertDraftScope, claimDraft } from "../drafts/edit";
import { findDraft, toView } from "../drafts/queries";
import { TillError } from "../error";
import { checkSession } from "../session";
import { readLookupCustomer } from "./queries";

type Scope = { orgId: string; deviceId: string; branchId: string };
type Created = Extract<CustomerEvent, { type: "customer.created" }>;
type Queued<E = CustomerEvent> = { scope: Scope; session: TillSession; at: Date; event: E };

/** Makes a customer usable at once and queues it for the upload lane; the reply is the lookup row, `pending`. */
export async function createTillCustomer(
  db: TillDatabase,
  context: CommandContext,
  input: { scope: Scope; session: TillSession; at: Date; customer: unknown },
) {
  checkSession(input.session, input.scope, "customer.write", input.at);
  const { id, name, phone, kind, businessName, tin } = v.parse(customerInput, {
    ...(input.customer as object),
    id: v7(),
  });
  const event: Created = {
    v: 1,
    type: "customer.created",
    customer: {
      orgId: input.scope.orgId,
      sessionId: input.session.id,
      occurredAt: input.at.toISOString(),
      id,
      name,
      phone,
      kind,
      businessName: businessName ?? null,
      tin: tin ?? null,
    },
  };
  return create(db, context, { ...input, event });
}

/** Edits a customer here and now, and queues only the fields that changed, with the version the till last saw. */
export async function updateTillCustomer(db: TillDatabase, context: CommandContext, raw: unknown) {
  const input = v.parse(updateTillCustomerInput, raw);
  checkSession(input.session, input.scope, "customer.write", input.at);
  return update(db, context, input);
}

/** Puts a customer from the lookup on the open basket, or takes them off with `null`. */
export async function attachDraftCustomer(db: TillDatabase, context: CommandContext, raw: unknown) {
  const input = v.parse(attachCustomerInput, raw);
  assertDraftScope(context, input.scope);
  checkSession(input.session, input.scope, "customer.read", input.at);
  return attach(db, context, input);
}

const create = defineCommand({
  name: "till.customer.create",
  async run(tx, _context, input: Queued<Created>) {
    const { id, name, phone, kind, businessName, tin } = input.event.customer;
    const { orgId } = input.scope;
    await tx
      .insert(customerLookup)
      .values({ orgId, customerId: id, name, phone, kind, businessName, tin, version: 1 });
    await queue(tx, input);
    return {
      id,
      name,
      phone,
      kind,
      businessName: businessName ?? null,
      tin: tin ?? null,
      version: 1,
      pending: true,
    };
  },
  audit: (input) => ({ customerId: input.event.customer.id }),
  details: (input) => ({ entity: "customer", entityId: input.event.customer.id }),
});

const update = defineCommand({
  name: "till.customer.update",
  async run(tx, _context, input: v.InferOutput<typeof updateTillCustomerInput>) {
    const [row] = await tx
      .select()
      .from(customerLookup)
      .where(
        and(
          eq(customerLookup.orgId, input.scope.orgId),
          eq(customerLookup.customerId, input.customerId),
        ),
      );
    if (!row) throw new TillError("CUSTOMER_UNKNOWN", "Unknown customer");
    // Only what differs travels: a field left alone must not overwrite someone else's edit on the server.
    const changes = Object.fromEntries(
      Object.entries(input.changes).filter(
        ([field, value]) => (row[field as keyof typeof row] ?? null) !== (value ?? null),
      ),
    );
    const parsed = v.parse(customerChanges, changes);
    const { name, phone, kind, businessName, tin } = { ...row, ...parsed };
    v.parse(customerFields, { name, phone, kind, businessName, tin });
    await tx
      .update(customerLookup)
      .set(parsed)
      .where(
        and(eq(customerLookup.orgId, row.orgId), eq(customerLookup.customerId, row.customerId)),
      );
    await queue(tx, {
      scope: input.scope,
      session: input.session,
      at: input.at,
      event: {
        v: 1,
        type: "customer.updated",
        customer: {
          orgId: row.orgId,
          sessionId: input.session.id,
          occurredAt: input.at.toISOString(),
          id: row.customerId,
          baseVersion: row.version,
          changes: parsed,
        },
      },
    });
    return {
      id: row.customerId,
      name,
      phone,
      kind,
      businessName,
      tin,
      version: row.version,
      pending: true,
    };
  },
  audit: (input) => ({ customerId: input.customerId, fields: Object.keys(input.changes) }),
  details: (input) => ({ entity: "customer", entityId: input.customerId }),
});

const attach = defineCommand({
  name: "till.draft.customer",
  async run(tx, _context, input: v.InferOutput<typeof attachCustomerInput>) {
    if (input.customerId && !(await readLookupCustomer(tx, input.scope.orgId, input.customerId)))
      throw new TillError("CUSTOMER_UNKNOWN", "Unknown customer");
    // The customer may come before the first scan: with no basket yet, attaching opens one (revision 1).
    if (!(await findDraft(tx, input.scope))) return openWith(tx, input);
    const found = await claimDraft(tx, input.scope, input.expectedRevision, input.at);
    await tx
      .update(saleDraft)
      .set({ customerId: input.customerId })
      .where(eq(saleDraft.id, found.draft.id));
    const draft = { ...found.draft, customerId: input.customerId };
    return toView(tx, input.scope, input.at, { draft, lines: found.lines });
  },
  audit: (input) => ({ customerId: input.customerId }),
});

async function openWith(tx: TillSqlite, input: v.InferOutput<typeof attachCustomerInput>) {
  if (input.expectedRevision !== 0)
    throw new TillError("REVISION_STALE", `Draft is not at revision ${input.expectedRevision}`);
  if (!input.customerId) return toView(tx, input.scope, input.at);
  const stamp = input.at.toISOString();
  const [draft] = await tx
    .insert(saleDraft)
    .values({
      ...input.scope,
      id: v7(),
      revision: 1,
      totals: {},
      customerId: input.customerId,
      createdAt: stamp,
      updatedAt: stamp,
    })
    .returning();
  return toView(tx, input.scope, input.at, { draft: draft!, lines: [] });
}

/** Keeps the session beside the event, as a sale does, so its proof outlives the sign-in. */
async function queue(tx: TillSqlite, { scope, session, at, event }: Queued) {
  await tx.insert(hostSession).values(session).onConflictDoNothing();
  await tx.insert(customerUpload).values({
    id: v7(),
    orgId: scope.orgId,
    deviceId: scope.deviceId,
    customerId: event.customer.id,
    payload: event,
    sessionId: session.id,
    createdAt: at.toISOString(),
  });
}
