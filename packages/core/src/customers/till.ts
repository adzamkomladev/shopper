import * as v from "valibot";
import { and, eq, sql } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import {
  auditLog,
  cashierSession,
  customer,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { sha256 } from "@shopper/utils";
import { sessionAuthority } from "../sales/authority";
import { SaleError } from "../sales/error";
import type { UploadPrincipal } from "../sales/types";
import { customerEvent, type CustomerEvent } from "../schemas/customers/events";
import { customerFields, customerInput } from "../schemas/customers/inputs";
import { customerUpsert } from "../changes";
import { fieldsOf, insertCustomer, savedCreate } from "./commands";
import { publishCustomer } from "./feed";
import { CustomerError } from "./error";
import { laterThanServer } from "./lww";
import { SALE_CREATE } from "./sale";
import { readCustomerRow } from "./queries";

type Created = Extract<CustomerEvent, { type: "customer.created" }>;
type Updated = Extract<CustomerEvent, { type: "customer.updated" }>;
type Fields = ReturnType<typeof fieldsOf>;
type Input<E> = {
  principal: UploadPrincipal;
  event: E;
  requestId: string;
  proofHash: string;
  /** When the cashier acted, never later than now. */
  occurredAt: Date;
  cashierId: string;
};
type Applied = {
  id: string;
  requestId: string;
  occurredAt: string;
  baseVersion: number;
  currentVersion: number;
  /** The customer's version after this event; the history of later edits is read from it. */
  version: number;
  before: Fields;
  after: Fields;
  applied: string[];
  skipped: string[];
};

/**
 * Applies one customer event from a till and answers the customer as it now stands. A rejection (`SaleError` or
 * `CustomerError`) is terminal for the till; a concurrent edit is never one, it resolves field by field.
 */
export async function acceptCustomerEvent(
  db: ShopperDatabase,
  principal: UploadPrincipal,
  raw: unknown,
  proof: string,
  requestId: string,
  options: { appVersion: string; now?: () => number },
) {
  const event = v.parse(customerEvent, raw);
  const { customer: body } = event;
  if (body.orgId !== principal.orgId)
    throw new SaleError("SCOPE", "Customer is outside the enrolled device scope");
  const proofHash = await sha256(proof);
  const [session] = await db
    .select({ userId: cashierSession.userId, issuedAt: cashierSession.issuedAt })
    .from(cashierSession)
    .where(
      and(
        eq(cashierSession.orgId, principal.orgId),
        eq(cashierSession.id, body.sessionId),
        eq(cashierSession.tokenHash, proofHash),
      ),
    );
  if (!session) throw new SaleError("INVALID_SESSION", "Customer lacks a valid cashier session");
  // ponytail: a till clock running ahead can win last-writer-wins over a later portal edit; the upgrade is a
  // monotonic offset from the last server handshake.
  const occurredAt = new Date(Math.min((options.now ?? Date.now)(), Date.parse(body.occurredAt)));
  const context = {
    orgId: principal.orgId,
    deviceId: principal.deviceId,
    branchId: principal.branchId,
    actorId: session.userId,
    deviceTime: occurredAt,
    appVersion: options.appVersion,
  };
  const input = { principal, requestId, proofHash, occurredAt, cashierId: session.userId };
  if (event.type === "customer.created") await create(db, context, { ...input, event });
  else await update(db, context, { ...input, event });
  const [row] = await db
    .select()
    .from(customer)
    .where(and(eq(customer.orgId, principal.orgId), eq(customer.id, body.id)));
  return { id: row!.id, version: row!.version, customer: customerUpsert(row!).payload };
}

const newCustomer = ({ customer: c }: Created) =>
  v.parse(customerInput, {
    id: c.id,
    name: c.name,
    phone: c.phone,
    kind: c.kind,
    businessName: c.businessName,
    tin: c.tin,
  });

/** The session was good when the cashier acted; a till clock behind the sign-in reads as the sign-in itself. */
async function authorize(tx: ShopperTransaction, ctx: CommandContext, input: Input<CustomerEvent>) {
  const { sessionId } = input.event.customer;
  const [session] = await tx
    .select({ issuedAt: cashierSession.issuedAt })
    .from(cashierSession)
    .where(and(eq(cashierSession.orgId, ctx.orgId), eq(cashierSession.id, sessionId)));
  const at = new Date(Math.max(input.occurredAt.valueOf(), session?.issuedAt.valueOf() ?? 0));
  const granted = await sessionAuthority(
    tx,
    ctx,
    input.principal,
    { sessionId, cashierId: input.cashierId },
    input.proofHash,
    at,
    "customer.write",
    "PERMISSION_DENIED",
  );
  ctx.role = granted.roleName;
}

const create = defineCommand({
  name: "customer.till.create",
  async replay(tx, ctx, input: Input<Created>) {
    const { id } = input.event.customer;
    // A sale of this till already created the customer, from the fields as they stood when it sold.
    const output = (await soldTo(tx, ctx, id))
      ? { id, replayed: true }
      : await savedCreate(tx, ctx.orgId, newCustomer(input.event));
    if (output) await authorize(tx, ctx, input);
    return output && { output };
  },
  async run(tx, ctx, input: Input<Created>) {
    await authorize(tx, ctx, input);
    return insertCustomer(tx, ctx, newCustomer(input.event));
  },
  audit: (input, output) => ({ id: output.id, requestId: input.requestId }),
  details: (_input, output) => ({ entity: "customer", entityId: output.id }),
});

/** Whether this device's sale created the customer, so its own `customer.created` is a replay whatever was edited since. */
async function soldTo(tx: ShopperTransaction, ctx: CommandContext, id: string) {
  const [made] = await tx
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.orgId, ctx.orgId),
        eq(auditLog.command, SALE_CREATE),
        eq(auditLog.entityId, id),
        eq(auditLog.deviceId, ctx.deviceId!),
      ),
    );
  return Boolean(made);
}

const update = defineCommand({
  name: "customer.till.update",
  async replay(tx, ctx, input: Input<Updated>) {
    const [done] = await tx
      .select({ payload: auditLog.payload })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.orgId, ctx.orgId),
          eq(auditLog.command, "customer.till.update"),
          sql`${auditLog.payload}->>'requestId' = ${input.requestId}`,
        ),
      );
    if (done) await authorize(tx, ctx, input);
    return done && { output: done.payload as Applied };
  },
  async run(tx, ctx, input: Input<Updated>): Promise<Applied> {
    await authorize(tx, ctx, input);
    const { id, baseVersion, changes } = input.event.customer;
    const current = await readCustomerRow(tx, ctx.orgId, id, true);
    // Terminal for the till, which marks the edit rejected and moves on; an edit never reaches a customer who left the till.
    if (current.mergedIntoId)
      throw new CustomerError("MERGED", "The customer was merged into another");
    if (current.archivedAt) throw new CustomerError("ARCHIVED", "The customer is archived");
    const applied =
      baseVersion === current.version
        ? changes
        : await laterThanServer(tx, ctx.orgId, input.event.customer, input.occurredAt);
    const before = fieldsOf(current);
    const after = fieldsOf(v.parse(customerFields, { ...before, ...applied }));
    let version = current.version;
    if (Object.keys(applied).length) {
      const [row] = await tx
        .update(customer)
        .set({ ...applied, version: sql`${customer.version} + 1`, updatedAt: new Date() })
        .where(and(eq(customer.orgId, ctx.orgId), eq(customer.id, id)))
        .returning();
      await publishCustomer(tx, ctx.orgId, row!);
      version = row!.version;
    }
    return {
      id,
      requestId: input.requestId,
      occurredAt: input.occurredAt.toISOString(),
      baseVersion,
      currentVersion: current.version,
      version,
      before,
      after,
      applied: Object.keys(applied),
      skipped: Object.keys(changes).filter((field) => !(field in applied)),
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
