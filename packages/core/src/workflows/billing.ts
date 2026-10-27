import * as v from "valibot";
import type { WorkflowCheckpoint } from "@shopper/audit";
import { user } from "@shopper/db-pg";
import { money } from "@shopper/money";
import { WorkflowTimeoutError, type Workflow } from "@shopper/ports";
import { inArray } from "drizzle-orm";
import { orgOwners } from "../audit/anchor";
import { billingId, READ_ONLY_AFTER_DAYS } from "../billing/access";
import { dunInvoice, issueInvoice, publishInvoice, settleInvoice } from "../billing/commands";
import { billingParams } from "../billing/schemas/base";
import type { BillingDeps } from "../billing/types";

const policy = { maxAttempts: 5, delayMs: 1000, backoff: "exponential" } as const;
const DAY_MS = 86_400_000;
/** Days after the period starts: two reminders, then the back office turns read-only. */
const DUNNING = [
  { days: 3, step: "reminder" },
  { days: 7, step: "reminder" },
  { days: READ_ONLY_AFTER_DAYS, step: "read_only" },
] as const;

/**
 * One billing period: on its first day raise the invoice and its Paystack checkout and email the owners, then until
 * the "invoice.paid" event remind at +3 and +7 days and turn the back office read-only at +14. Paying restores
 * access through the webhook at once; this workflow only stops dunning. The watchdog starts each period.
 */
export async function runBilling(
  flow: Pick<Workflow, "instanceId" | "step" | "sleepUntil" | "waitFor">,
  deps: BillingDeps,
  raw: unknown,
) {
  const params = v.parse(billingParams, raw);
  if (flow.instanceId !== billingId(params.orgId, params.periodStart))
    throw new Error("Billing instance must be its org and period");
  const context = { orgId: params.orgId, appVersion: deps.appVersion, queue: deps.queue };
  const checkpoint = (step: string, status: WorkflowCheckpoint["status"] = "waiting") => ({
    instanceId: flow.instanceId,
    businessKey: flow.instanceId,
    type: "billing",
    step,
    status,
  });
  const start = Date.parse(`${params.periodStart}T00:00:00.000Z`);
  await flow.sleepUntil("due", new Date(start));
  const raised = await flow.step("issue", policy, () =>
    deps.withDatabase((db) =>
      issueInvoice(db, context, { periodStart: params.periodStart }, checkpoint("issue")),
    ),
  );
  if (raised.status !== "open") return;
  await flow.step("publish", policy, async () => {
    const checkoutUrl = deps.paystack ? await checkout(deps, params.orgId, raised) : null;
    return deps.withDatabase((db) =>
      publishInvoice(db, context, { id: raised.id, checkoutUrl }, checkpoint("publish")),
    );
  });
  for (const due of DUNNING) {
    const paid = await flow
      .waitFor(
        `paid-${due.days}`,
        "invoice.paid",
        Math.max(1, start + due.days * DAY_MS - Date.now()),
      )
      .then(
        () => true,
        (error: unknown) => {
          if (error instanceof WorkflowTimeoutError) return false;
          throw error;
        },
      );
    if (paid)
      return await flow.step("settled", policy, () =>
        deps.withDatabase((db) =>
          settleInvoice(db, context, { id: raised.id }, checkpoint("settled", "completed")),
        ),
      );
    await flow.step(`${due.step}-${due.days}`, policy, () =>
      deps.withDatabase((db) =>
        dunInvoice(
          db,
          context,
          { id: raised.id, step: due.step },
          checkpoint(`${due.step}-${due.days}`, due.step === "read_only" ? "completed" : "waiting"),
        ),
      ),
    );
  }
}

/** The invoice's Paystack checkout, billed to the first owner's email. */
async function checkout(deps: BillingDeps, orgId: string, raised: { id: string; amount: number }) {
  const [email] = await deps.withDatabase(async (db) => {
    const owners = await orgOwners(db, orgId);
    return owners.length
      ? db
          .select({ email: user.email })
          .from(user)
          .where(
            inArray(
              user.id,
              owners.map((owner) => owner.id),
            ),
          )
      : [];
  });
  if (!email) return null;
  const page = await deps.paystack!.initialize({
    reference: raised.id,
    amount: money(raised.amount),
    email: email.email,
    metadata: { orgId, invoiceId: raised.id },
  });
  return page.url;
}
