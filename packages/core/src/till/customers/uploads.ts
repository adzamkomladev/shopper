import * as v from "valibot";
import { eq, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit/sqlite";
import { customerUpload } from "@shopper/db-sqlite";
import { tillCustomer } from "../../schemas/till/reference";
import { projectCustomers } from "../lookup/customers";

type Mark = { id: string };
const entity = (input: Mark) => ({ entity: "customer_upload", entityId: input.id });

/**
 * The server saved the customer or edit. Its answer carries the customer as it now stands, which replaces the lookup
 * row (a concurrent portal edit may have won some fields); edits still queued behind it go back on top.
 */
export const markCustomerAccepted = defineCommand({
  name: "customer.upload.accept",
  async run(tx, _context, input: Mark & { result: Record<string, unknown>; at: Date }) {
    const server = v.parse(tillCustomer, input.result.customer);
    await tx
      .update(customerUpload)
      .set({ acceptedAt: input.at.toISOString(), result: input.result, nextAttemptAt: null })
      .where(eq(customerUpload.id, input.id));
    await projectCustomers(tx, server.orgId, [server]);
  },
  audit: (input) => ({ uploadId: input.id }),
  details: entity,
});

/** Terminal: the server refused it; it stays with the reason and is never retried. */
export const markCustomerRejected = defineCommand({
  name: "customer.upload.reject",
  async run(tx, _context, input: Mark & { code: string; reason: string }) {
    await tx
      .update(customerUpload)
      .set({ blockedCode: input.code, blockedReason: input.reason, nextAttemptAt: null })
      .where(eq(customerUpload.id, input.id));
  },
  audit: (input) => ({ uploadId: input.id, code: input.code, reason: input.reason }),
  details: entity,
});

/** Counts a failed attempt and defers the next one to `nextAttemptAt` (epoch ms). */
export const markCustomerFailed = defineCommand({
  name: "customer.upload.failed",
  async run(tx, _context, input: Mark & { nextAttemptAt: number; reason: string }) {
    await tx
      .update(customerUpload)
      .set({ attempts: sql`${customerUpload.attempts} + 1`, nextAttemptAt: input.nextAttemptAt })
      .where(eq(customerUpload.id, input.id));
  },
  audit: (input) => ({ uploadId: input.id, reason: input.reason }),
  details: entity,
});
