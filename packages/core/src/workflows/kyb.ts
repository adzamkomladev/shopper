import * as v from "valibot";
import { eq } from "drizzle-orm";
import { verifyKybDocument } from "@shopper/assets";
import type { WorkflowCheckpoint } from "@shopper/audit";
import { kybCase } from "@shopper/db-pg";
import type { Workflow } from "@shopper/ports";
import { runKybChecks } from "../kyb/checks";
import { closeKyb, expireKyb, remindKybRenewal, saveKybSubaccount } from "../kyb/commands/payout";
import { recordKybChecks } from "../kyb/commands/review";
import { kybId } from "../kyb/records";
import { kybFlowParams } from "../kyb/schemas/base";
import type { KybFlowDeps } from "./types";
import { MAX_WAIT_MS, woken } from "./wait";

const policy = { maxAttempts: 5, delayMs: 1000, backoff: "exponential" } as const;
const DAY_MS = 86_400_000;
const RENEW_BEFORE_MS = 30 * DAY_MS;

type Flow = Pick<Workflow, "instanceId" | "step" | "waitFor">;

/**
 * One shop's business verification from submission to payouts. The case row is the record: each tick reads it and
 * does the one thing its status asks for (check, wait for the reviewer, open the subaccount, remind, expire), so a
 * lost wake is caught up at the next deadline. A case back with the owner ends the run; resubmitting starts it again.
 */
export async function runKyb(flow: Flow, deps: KybFlowDeps, raw: unknown) {
  const params = v.parse(kybFlowParams, raw);
  if (flow.instanceId !== kybId(params.orgId)) throw new Error("KYB instance must be its org");
  // Read at each tick, not captured: a run that waits for weeks sees the clock of the moment it wakes.
  const now = () => deps.now?.() ?? Date.now();
  const context = { orgId: params.orgId, appVersion: deps.appVersion, queue: deps.queue };
  const checkpoint = (step: string, status: WorkflowCheckpoint["status"] = "waiting") => ({
    instanceId: flow.instanceId,
    businessKey: flow.instanceId,
    type: "kyb",
    step,
    status,
  });
  const read = () =>
    deps.withDatabase(async (db) => {
      const [row] = await db.select().from(kybCase).where(eq(kybCase.orgId, params.orgId));
      if (!row) throw new Error("KYB case not found");
      return row;
    });
  for (let tick = 0; ; tick++) {
    // The time is read in the step, so a replay after hibernation takes the same branch.
    const state = await flow.step(`case-${tick}`, policy, async () => {
      const row = await read();
      return {
        at: now(),
        status: row.status,
        version: row.version,
        expiresAt: row.expiresOn ? Date.parse(row.expiresOn) : null,
        subaccount: Boolean(row.subaccountCode),
        renewed: Boolean(row.renewalSentAt),
      };
    });
    const step = (name: string) => `${name}-${state.version}`;
    if (state.status === "submitted") {
      await flow.step(step("checks"), policy, async () => {
        const row = await read();
        const banks = new Set((await deps.paystack.banks()).map((bank) => bank.code));
        const checks = await deps.withDatabase((db) =>
          runKybChecks(row, {
            banks,
            verified: (id) => verifyKybDocument(db, deps.blobs, params.orgId, id),
            today: new Date(state.at).toISOString().slice(0, 10),
          }),
        );
        return deps.withDatabase((db) =>
          recordKybChecks(
            db,
            context,
            { version: state.version, checks },
            checkpoint(step("checks")),
          ),
        );
      });
      continue;
    }
    if (state.status === "in_review") {
      await woken(flow, `review-${tick}`, MAX_WAIT_MS);
      continue;
    }
    // Back with the owner, or approved for good: the run ends, and its record says so.
    const close = () =>
      flow.step(step("close"), policy, () =>
        deps.withDatabase((db) =>
          closeKyb(db, context, {}, checkpoint(step("close"), "completed")),
        ),
      );
    if (state.status !== "approved") return void (await close());
    if (!state.subaccount) {
      await flow.step(step("subaccount"), policy, async () => {
        const row = await read();
        // A code kept by an earlier attempt is never made again.
        if (row.subaccountCode) return { code: row.subaccountCode, saved: false };
        const made = await deps.paystack.createSubaccount({
          businessName: row.businessName!,
          settlementBank: row.settlementBank!,
          accountNumber: row.settlementAccount!,
        });
        return deps.withDatabase((db) =>
          saveKybSubaccount(db, context, made, checkpoint(step("subaccount"))),
        );
      });
      continue;
    }
    if (state.expiresAt === null) return void (await close());
    if (state.at >= state.expiresAt) {
      await flow.step(step("expire"), policy, () =>
        deps.withDatabase((db) =>
          expireKyb(
            db,
            context,
            { version: state.version, today: new Date(state.at).toISOString().slice(0, 10) },
            checkpoint(step("expire"), "completed"),
          ),
        ),
      );
      continue;
    }
    const renewAt = state.expiresAt - RENEW_BEFORE_MS;
    if (!state.renewed && state.at >= renewAt) {
      await flow.step(step("renew"), policy, () =>
        deps.withDatabase((db) =>
          remindKybRenewal(db, context, { version: state.version }, checkpoint(step("renew"))),
        ),
      );
      continue;
    }
    const until = state.renewed ? state.expiresAt : renewAt;
    await woken(flow, `approved-${tick}`, Math.min(MAX_WAIT_MS, Math.max(1, until - state.at)));
  }
}
