import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import * as v from "valibot";
import { enqueueAfterCommit } from "@shopper/audit";
import type { ShopperDatabase, ShopperTransaction } from "@shopper/db-pg";
import type { Delivery, WorkflowLauncher } from "@shopper/ports";
import { accountSettingsMessage, accountWakeMessage } from "../../schemas/customers/accounts";

const envelope = (orgId: string, type: string, payload: Record<string, string>) => ({
  id: v7(),
  orgId,
  v: 1,
  sequence: "0",
  type,
  payload,
});

/** After the command commits, start the customer's account workflow, or wake it if it is running. */
export const wakeAccount = (tx: ShopperTransaction, orgId: string, customerId: string) =>
  enqueueAfterCommit(tx, envelope(orgId, "account.wake", { customerId }));

/** After a settings change commits, one queue message fans the wake out to every account it may touch. */
export const wakeAccounts = (tx: ShopperTransaction, orgId: string) =>
  enqueueAfterCommit(tx, envelope(orgId, "account.settings", {}));

/** The queue side of the wakes; without an account launcher the message retries rather than vanish. */
export async function deliverAccountMessage(
  deps: { db: ShopperDatabase; accounts?: WorkflowLauncher },
  delivery: Delivery,
) {
  const { accounts } = deps;
  if (!accounts) return await delivery.retry();
  try {
    if (delivery.message.type === "account.wake") {
      const { orgId, payload } = v.parse(accountWakeMessage, delivery.message);
      await accounts.start(payload.customerId, { orgId, customerId: payload.customerId });
    } else {
      const { orgId } = v.parse(accountSettingsMessage, delivery.message);
      // ponytail: one consumer run starts every account with a ledger; send per-customer wakes in pages at scale.
      for (const { id } of await ledgerCustomers(deps.db, orgId))
        await accounts.start(id, { orgId, customerId: id });
    }
    await delivery.ack();
  } catch (error) {
    console.error({ event: "account.wake_failed", attempts: delivery.attempts, error });
    await delivery.retry();
  }
}

/** Active customers with anything on either ledger, in one org or (on a box at boot) every org. */
export async function ledgerCustomers(db: ShopperDatabase, orgId?: string) {
  const { rows } = await db.execute<{ org_id: string; id: string }>(sql`
    SELECT c.org_id, c.id FROM customer c
    WHERE c.archived_at IS NULL AND (${orgId ?? null}::uuid IS NULL OR c.org_id = ${orgId ?? null}::uuid)
      AND (EXISTS (SELECT 1 FROM credit_entry e WHERE e.org_id = c.org_id AND e.customer_id = c.id)
        OR EXISTS (SELECT 1 FROM loyalty_entry e WHERE e.org_id = c.org_id AND e.customer_id = c.id))`);
  return rows;
}
