import * as v from "valibot";
import type { Workflow } from "@shopper/ports";
import type { SettlementDeps } from "../../payments/types";
import { failSettlement, recordSettlements, settlementId } from "../../payments/settlements/record";
import { settlementParams } from "../../payments/schemas/settlements";

const policy = { maxAttempts: 5, delayMs: 2000, backoff: "exponential" } as const;

/** One org-day's Paystack payouts: fetched and recorded in one checkpointed step, so a restart records nothing twice. */
export async function runSettlement(
  flow: Pick<Workflow, "instanceId" | "step">,
  deps: SettlementDeps,
  raw: unknown,
) {
  const params = v.parse(settlementParams, raw);
  if (!flow.instanceId.startsWith(settlementId(params.orgId, params.day)))
    throw new Error("Settlement instance must be its org-day key");
  const checkpoint = (step: string, status: "completed" | "failed") => ({
    instanceId: flow.instanceId,
    businessKey: flow.instanceId,
    type: "settlement",
    step,
    status,
  });
  const context = { orgId: params.orgId, appVersion: deps.appVersion };
  await flow
    .step("settle", policy, async () => {
      const payouts = await deps.paystack.settlements({ from: params.day, to: params.day });
      return deps.withDatabase((db) =>
        recordSettlements(
          db,
          context,
          { day: params.day, payouts },
          checkpoint("settle", "completed"),
        ),
      );
    })
    .catch(async (error: unknown) => {
      await deps.withDatabase((db) =>
        failSettlement(
          db,
          context,
          { day: params.day, reason: error instanceof Error ? error.message : String(error) },
          checkpoint("failed", "failed"),
        ),
      );
      throw error;
    });
}
