import * as v from "valibot";
import { eq } from "drizzle-orm";
import type { WorkflowCheckpoint } from "@shopper/audit";
import { onboarding, registrationRequest } from "@shopper/db-pg";
import type { Workflow } from "@shopper/ports";
import {
  abandonRegistration,
  closeOnboarding,
  MAX_NUDGES,
  nudgeOnboarding,
  registeredOnboarding,
  remindRegistration,
  startOnboarding,
} from "../onboarding/commands";
import { onboardingId } from "../onboarding/records";
import { onboardingParams } from "../onboarding/schemas/base";
import type { OnboardingFlowDeps } from "./types";
import { MAX_WAIT_MS, woken } from "./wait";

const policy = { maxAttempts: 5, delayMs: 1000, backoff: "exponential" } as const;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** Verification reminders, after signup. */
const REMINDERS = [2 * HOUR_MS, 12 * HOUR_MS] as const;
/** Nudges toward the first sale, after provisioning, then a month before the onboarding ends without one. */
const NUDGES = [1 * DAY_MS, 3 * DAY_MS, 7 * DAY_MS] as const;
const GIVE_UP_MS = 30 * DAY_MS;

type Flow = Pick<Workflow, "instanceId" | "step" | "waitFor">;

/**
 * One shop from signup to its first sale. Until the shop exists the registration request is the record: an
 * unverified owner is reminded at +2 h and +12 h, and an expired link ends it. Once provisioned, the onboarding row
 * is: nudges at +1, +3 and +7 days until the first sale ends it as trading, or a month passes. Events only wake
 * the loop; every decision reads the row, so a lost event is caught up at the next deadline.
 */
export async function runOnboarding(flow: Flow, deps: OnboardingFlowDeps, raw: unknown) {
  const params = v.parse(onboardingParams, raw);
  if (flow.instanceId !== onboardingId(params.orgId))
    throw new Error("Onboarding instance must be its org");
  if (!(await awaitShop(flow, deps, params.orgId))) return;
  await awaitFirstSale(flow, deps, params.orgId);
}

/** True once the shop is provisioned; false when the signup expired first. */
async function awaitShop(flow: Flow, deps: OnboardingFlowDeps, id: string) {
  const now = deps.now ?? Date.now;
  const context = { orgId: id, appVersion: deps.appVersion };
  const checkpoint = checkpointFor(flow.instanceId);
  let reminded = 0;
  for (let tick = 0; ; tick++) {
    const state = await flow.step(`registration-${tick}`, policy, () =>
      deps.withDatabase(async (db) => {
        const [row] = await db
          .select()
          .from(registrationRequest)
          .where(eq(registrationRequest.id, id));
        if (!row) throw new Error("Registration not found");
        return {
          at: now(),
          createdAt: row.createdAt.getTime(),
          expiresAt: row.expiresAt.getTime(),
          verified: Boolean(row.verifiedAt),
          completed: Boolean(row.completedAt),
        };
      }),
    );
    if (state.completed) {
      await flow.step("provisioned", policy, () =>
        deps.withDatabase((db) =>
          registeredOnboarding(db, context, {}, checkpoint("provisioned", "completed")),
        ),
      );
      return true;
    }
    if (state.at >= state.expiresAt) {
      await flow.step("abandon", policy, () =>
        deps.withDatabase((db) =>
          abandonRegistration(db, context, {}, checkpoint("abandon", "completed")),
        ),
      );
      return false;
    }
    const reminder = REMINDERS[reminded];
    const remindAt = !state.verified && reminder ? state.createdAt + reminder : Infinity;
    if (state.at >= remindAt) {
      const step = `remind-${reminded++}`;
      await flow.step(step, policy, async () => {
        const result = await deps.withDatabase((db) =>
          remindRegistration(db, context, { now: state.at }, checkpoint(step)),
        );
        // The auth flow sends the verification email again, as a resend from the owner would.
        if (result.due) await deps.authFlows?.send(id, "auth-action", { action: "retry" });
        return result;
      });
      continue;
    }
    await woken(
      flow,
      `registration-wait-${tick}`,
      wait(Math.min(remindAt, state.expiresAt), state.at),
    );
  }
}

async function awaitFirstSale(flow: Flow, deps: OnboardingFlowDeps, orgId: string) {
  const now = deps.now ?? Date.now;
  const context = { orgId, appVersion: deps.appVersion, queue: deps.queue };
  const checkpoint = checkpointFor(flow.instanceId);
  await flow.step("start", policy, () =>
    deps.withDatabase((db) => startOnboarding(db, context, {}, checkpoint("start"))),
  );
  for (let tick = 0; ; tick++) {
    const state = await flow.step(`shop-${tick}`, policy, () =>
      deps.withDatabase(async (db) => {
        const [row] = await db.select().from(onboarding).where(eq(onboarding.orgId, orgId));
        if (!row) throw new Error("Onboarding row not found");
        return {
          at: now(),
          startedAt: row.createdAt.getTime(),
          trading: row.status === "trading",
          nudges: row.nudges,
        };
      }),
    );
    const nudge = NUDGES[state.nudges];
    const due = state.startedAt + (nudge ?? GIVE_UP_MS);
    if (state.trading || (state.nudges >= MAX_NUDGES && state.at >= due))
      return await flow.step("close", policy, () =>
        deps.withDatabase((db) =>
          closeOnboarding(db, context, {}, checkpoint("close", "completed")),
        ),
      );
    if (state.at >= due) {
      const step = `nudge-${state.nudges + 1}`;
      await flow.step(step, policy, () =>
        deps.withDatabase((db) => nudgeOnboarding(db, context, {}, checkpoint(step))),
      );
      continue;
    }
    await woken(flow, `shop-wait-${tick}`, wait(due, state.at));
  }
}

// Times come from the step that read the row, so a replay after hibernation takes the same branches.
const wait = (until: number, at: number) => Math.min(MAX_WAIT_MS, Math.max(1, until - at));

const checkpointFor =
  (instanceId: string) =>
  (step: string, status: WorkflowCheckpoint["status"] = "waiting"): WorkflowCheckpoint => ({
    instanceId,
    businessKey: instanceId,
    type: "onboarding",
    step,
    status,
  });
