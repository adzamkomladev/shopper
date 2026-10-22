import * as v from "valibot";
import { and, desc, eq, sql } from "drizzle-orm";
import { customerLookup, type TillDatabase, type TillSqlite } from "@shopper/db-sqlite";
import { ghanaPhone } from "../../schemas/fields";

const pending = sql<boolean>`EXISTS (SELECT 1 FROM customer_upload
  WHERE customer_upload.org_id = customer_lookup.org_id AND customer_upload.customer_id = customer_lookup.customer_id
    AND customer_upload.accepted_at IS NULL AND customer_upload.blocked_code IS NULL)`;
const columns = {
  id: customerLookup.customerId,
  name: customerLookup.name,
  phone: customerLookup.phone,
  kind: customerLookup.kind,
  businessName: customerLookup.businessName,
  tin: customerLookup.tin,
};

/** Every customer on this number, newest first. `pending` means an edit or the customer itself has not reached the server. */
export function findCustomers(db: TillDatabase, input: { orgId: string; phone: string }) {
  const phone = v.parse(ghanaPhone, input.phone);
  return db.read((tx) =>
    tx
      .select({ ...columns, version: customerLookup.version, pending: pending.mapWith(Boolean) })
      .from(customerLookup)
      .where(and(eq(customerLookup.orgId, input.orgId), eq(customerLookup.phone, phone)))
      .orderBy(desc(customerLookup.customerId)),
  );
}

/** The customer as a basket and a receipt show them, or null when the lookup no longer has them. */
export async function readLookupCustomer(tx: TillSqlite, orgId: string, id: string) {
  const [found] = await tx
    .select(columns)
    .from(customerLookup)
    .where(and(eq(customerLookup.orgId, orgId), eq(customerLookup.customerId, id)));
  return found ?? null;
}
