import * as v from "valibot";
import { and, eq, sql } from "drizzle-orm";
import { buildInfo } from "@shopper/config";
import {
  registrationRequest,
  registrationWorkflowStep,
  workflowStep,
  type ShopperDatabase,
} from "@shopper/db-pg";
import {
  uuidV7Schema,
  WorkflowTimeoutError,
  type Workflow,
  type WorkflowCheckpoint,
} from "@shopper/ports";
import { createLinkToken } from "../links/tokens";
import type { createMaileroo } from "../emails/maileroo";
import {
  prepareRegistration,
  prepareInvitation,
  deliverRegistration,
  deliverInvitation,
  endRegistration,
  endInvitation,
  readDeliveryState,
} from "./commands";
export const authFlowParamsSchema = v.variant("purpose", [
  v.strictObject({ purpose: v.literal("registration"), id: uuidV7Schema }),
  v.strictObject({ purpose: v.literal("invitation"), id: uuidV7Schema, orgId: uuidV7Schema }),
]);
const deliveryOutcomeSchema = v.strictObject({
  active: v.boolean(),
  expired: v.boolean(),
  expiresAt: v.string(),
  sent: v.boolean(),
});
export type AuthFlowParams = v.InferOutput<typeof authFlowParamsSchema>;
export interface AuthFlowDeps {
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  linkSecret: string;
  baseURL: string;
  mail?: ReturnType<typeof createMaileroo>;
  now?: () => number;
}
export async function runAuthFlow(
  flow: Pick<Workflow, "instanceId" | "step" | "waitFor">,
  deps: AuthFlowDeps,
  raw: unknown,
) {
  const params = v.parse(authFlowParamsSchema, raw);
  if (params.id !== flow.instanceId)
    throw new Error("Auth workflow instance must equal its business key");
  const context = {
    orgId: params.purpose === "registration" ? params.id : params.orgId,
    appVersion: buildInfo.version,
  };
  if (params.purpose === "registration") {
    const exists = await deps.withDatabase((db) =>
      db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${context.orgId}, 0))`);
        return (
          (
            await tx
              .select({ id: registrationRequest.id })
              .from(registrationRequest)
              .where(eq(registrationRequest.id, params.id))
          ).length > 0
        );
      }),
    );
    if (!exists) return;
  }
  const now = deps.now ?? Date.now;
  const policy = { maxAttempts: 3, delayMs: 1000, backoff: "exponential" } as const;
  const checkpoint = (step: string, status: WorkflowCheckpoint["status"]): WorkflowCheckpoint => ({
    instanceId: params.id,
    businessKey: params.id,
    type: params.purpose,
    step,
    status,
  });
  const prepare = params.purpose === "registration" ? prepareRegistration : prepareInvitation;
  const deliver = params.purpose === "registration" ? deliverRegistration : deliverInvitation;
  const end = params.purpose === "registration" ? endRegistration : endInvitation;
  let expired = false;
  try {
    for (let attempt = 0; ; attempt++) {
      const name = `delivery-${attempt}`;
      const result = await flow.step(name, policy, async () => {
        const steps = params.purpose === "registration" ? registrationWorkflowStep : workflowStep;
        const [saved] = await deps.withDatabase((db) =>
          db
            .select({ output: steps.output })
            .from(steps)
            .where(
              and(
                eq(steps.orgId, context.orgId),
                eq(steps.instanceId, params.id),
                eq(steps.name, name),
              ),
            )
            .limit(1),
        );
        if (saved) return v.parse(deliveryOutcomeSchema, saved.output);
        await deps.withDatabase((db) =>
          prepare(db, context, { params, now: now() }, checkpoint(`prepare-${name}`, "waiting")),
        );
        const token = deps.mail
          ? await createLinkToken(deps.linkSecret, params.purpose, params.id)
          : undefined;
        // Preparation can replay a committed checkpoint; eligibility comes from the live row.
        const state = await deps.withDatabase((db) =>
          readDeliveryState(db, { params, now: now() }),
        );
        let sent = state.channel === "local";
        if (state.active && !sent && deps.mail && token) {
          const url = new URL(
            params.purpose === "registration" ? "/verify-registration" : "/accept-invitation",
            deps.baseURL,
          );
          url.searchParams.set("id", params.id);
          url.searchParams.set("token", token);
          if (params.purpose === "invitation") url.searchParams.set("shop", state.shopCode);
          try {
            await deps.mail({
              email: state.email,
              subject:
                params.purpose === "registration"
                  ? "Verify your Shopper email"
                  : "Join your shop on Shopper",
              link: url.toString(),
            });
            sent = true;
          } catch {
            sent = false;
          } // Failure becomes a retryable delivery outcome; the provider call holds no tenant lock.
        }
        return deps.withDatabase((db) =>
          deliver(
            db,
            context,
            { active: state.active, expired: state.expired, expiresAt: state.expiresAt, sent },
            checkpoint(name, "waiting"),
          ),
        );
      });
      if (!result.active) {
        expired = result.expired;
        break;
      }
      const timeoutMs = Math.max(0, new Date(result.expiresAt).getTime() - now());
      if (!timeoutMs) {
        expired = true;
        break;
      }
      try {
        const action = v.parse(
          v.strictObject({ action: v.picklist(["retry", "completed"]) }),
          await flow.waitFor(`action-${attempt}`, "auth-action", timeoutMs),
        );
        if (action.action === "completed") break;
      } catch (error) {
        if (!(error instanceof WorkflowTimeoutError)) throw error;
        expired = true;
        break;
      }
    }
    await flow.step("end", policy, () =>
      deps.withDatabase((db) =>
        end(db, context, { params, expired }, checkpoint("end", "completed")),
      ),
    );
  } catch (error) {
    await deps.withDatabase((db) =>
      end(db, context, { params, expired: false }, checkpoint("failure", "failed")),
    );
    throw error;
  }
}
