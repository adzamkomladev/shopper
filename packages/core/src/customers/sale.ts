import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import { appendTenantAudit, type CommandContext } from "@shopper/audit";
import { customer, type ShopperTransaction } from "@shopper/db-pg";
import { SaleError } from "../sales/error";
import { customerInput } from "../schemas/customers/inputs";
import type { SaleSnapshot } from "../schemas/till/sale";

type Row = typeof customer.$inferSelect;

/** The audit command of a customer the server first heard of from a sale; a till's later create is a replay of it. */
export const SALE_CREATE = "customer.sale.create";

/**
 * The customer a sale links to. The till's upload of a new customer may arrive after the sale, so the snapshot
 * creates it when the server has never seen the id; a known customer is never overwritten by it. A customer
 * merged away since the till last synced resolves to the one it was merged into. A snapshot that is no valid
 * customer links nothing, because a genuine sale is never refused. Publish `created` last.
 */
export async function ensureSaleCustomer(
  tx: ShopperTransaction,
  ctx: CommandContext,
  { customer: snapshot, id: saleId }: Pick<SaleSnapshot, "customer" | "id">,
): Promise<{ id: string | null; created: Row | null }> {
  if (!snapshot) return { id: null, created: null };
  const valid = v.safeParse(customerInput, snapshot);
  const [created] = valid.success
    ? await tx
        .insert(customer)
        .values({ ...valid.output, orgId: ctx.orgId, createdDeviceId: ctx.deviceId })
        .onConflictDoNothing()
        .returning()
    : [];
  if (created) {
    const after = {
      name: created.name,
      phone: created.phone,
      kind: created.kind,
      tin: created.tin,
    };
    await appendTenantAudit(tx, ctx, {
      command: SALE_CREATE,
      details: { entity: "customer", entityId: created.id, after },
      payload: { id: created.id, saleId },
    });
    return { id: created.id, created };
  }
  const current = await find(tx, ctx.orgId, snapshot.id);
  if (!current) {
    // The id exists but not here: only a forged sale carries another org's customer.
    if (valid.success)
      throw new SaleError("INVALID_REFERENCE", "Customer not found in this organisation");
    return { id: null, created: null };
  }
  return { id: (await mergeWinner(tx, ctx.orgId, current)).id, created: null };
}

/** The customer a merged-away one now lives on. Merges never loop, but a damaged chain stops at the last good row. */
export async function mergeWinner(
  tx: ShopperTransaction,
  orgId: string,
  start: Pick<Row, "id" | "mergedIntoId">,
) {
  let current = start;
  const seen = new Set([current.id]);
  while (current.mergedIntoId && !seen.has(current.mergedIntoId)) {
    const next = await find(tx, orgId, current.mergedIntoId);
    if (!next) break;
    seen.add(next.id);
    current = next;
  }
  return current;
}

async function find(tx: ShopperTransaction, orgId: string, id: string) {
  const [row] = await tx
    .select()
    .from(customer)
    .where(and(eq(customer.orgId, orgId), eq(customer.id, id)));
  return row;
}
