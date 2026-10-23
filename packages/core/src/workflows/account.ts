import * as v from "valibot";
import type { Workflow } from "@shopper/ports";
import { accountDue, endAccountRun, postDue } from "../customers/accounts/post";
import { accountFlowParams } from "../schemas/customers/accounts";
import type { AccountFlowDeps } from "./types";
import { MAX_WAIT_MS, woken } from "./wait";
export type { AccountFlowDeps } from "./types";

const policy = { maxAttempts: 5, delayMs: 1000, backoff: "exponential" } as const;

/**
 * One customer's account over time: sleep until the next due moment (a "wake" cuts the sleep short, so new earns,
 * charges and settings are seen), post what is due, repeat; end when nothing is due. PostgreSQL is the record:
 * every posting is idempotent, so a replayed or doubled run posts nothing twice.
 */
export async function runAccount(
  flow: Pick<Workflow, "instanceId" | "step" | "waitFor">,
  deps: AccountFlowDeps,
  raw: unknown,
) {
  const { orgId, customerId } = v.parse(accountFlowParams, raw);
  if (customerId !== flow.instanceId)
    throw new Error("Account workflow instance must equal its customer id");
  const context = { orgId, appVersion: deps.appVersion, queue: deps.queue };
  let posted: number | null = null;
  for (let tick = 0; ; tick++) {
    const due = await flow.step(`due-${tick}`, policy, () =>
      deps.withDatabase(
        async (db) => (await accountDue(db, orgId, customerId, new Date()))?.getTime() ?? null,
      ),
    );
    if (due === null) break;
    const wait = due - Date.now();
    // Woken early, or a long sleep cut short: look again. Slept to the due moment: post it.
    if (
      wait > 0 &&
      ((await woken(flow, `wait-${tick}`, Math.min(wait, MAX_WAIT_MS))) || wait > MAX_WAIT_MS)
    )
      continue;
    if (due === posted) throw new Error(`Account ${customerId} is still due after posting`);
    posted = due;
    await flow.step(`post-${tick}`, policy, () =>
      deps.withDatabase(async (db) => {
        await postDue(db, context, customerId, new Date(due), new Date());
        return { due };
      }),
    );
  }
  await flow.step("end", policy, () =>
    deps.withDatabase(async (db) => {
      await endAccountRun(db, orgId, customerId);
      return { ended: true };
    }),
  );
}
