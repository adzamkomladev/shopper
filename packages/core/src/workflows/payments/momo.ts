import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { payment, workflowStep } from "@shopper/db-pg";
import { WorkflowTimeoutError, type Workflow } from "@shopper/ports";
import { momoCheckpoint, recordMomoDeadline, updateMomo } from "../../payments/commands";
import { momoEvent, momoParams } from "../../payments/schemas/momo";
import type { MomoDeps } from "../../payments/types";

const policy = { maxAttempts: 3, delayMs: 1000, backoff: "constant" } as const;

export async function runMomoPayment(
  flow: Pick<Workflow, "instanceId" | "step" | "waitFor">,
  deps: MomoDeps,
  raw: unknown,
) {
  const params = v.parse(momoParams, raw);
  if (params.reference !== flow.instanceId) throw new Error("Payment business key mismatch");
  const context = { orgId: params.orgId, appVersion: deps.appVersion };
  const read = () =>
    deps.withDatabase(async (db) => {
      const [row] = await db
        .select()
        .from(payment)
        .where(and(eq(payment.orgId, params.orgId), eq(payment.reference, params.reference)));
      if (!row) throw new Error("Payment not found");
      return row;
    });
  const perform = (
    name: string,
    operation: () => Promise<Omit<Parameters<typeof updateMomo>[2], "reference">>,
    maxAttempts: number = policy.maxAttempts,
  ) =>
    flow.step(name, { ...policy, maxAttempts }, async () => {
      // PostgreSQL replay also survives a fresh box engine, before any provider request is repeated.
      const saved = await deps.withDatabase(async (db) => {
        const [row] = await db
          .select()
          .from(workflowStep)
          .where(
            and(
              eq(workflowStep.orgId, params.orgId),
              eq(workflowStep.instanceId, params.reference),
              eq(workflowStep.name, name),
            ),
          );
        return row?.output as Awaited<ReturnType<typeof updateMomo>> | undefined;
      });
      const result =
        saved ??
        (await (async () => {
          const response = await operation();
          return deps.withDatabase((db) =>
            updateMomo(
              db,
              context,
              { reference: params.reference, ...response },
              momoCheckpoint(
                params.reference,
                name,
                ["confirmed", "failed", "expired"].includes(response.status)
                  ? "completed"
                  : "waiting",
              ),
            ),
          );
        })());
      if (["confirmed", "failed", "expired"].includes(result.status))
        await deps.withDatabase((db) =>
          recordMomoDeadline(
            db,
            context,
            { reference: params.reference, deadline: 0 },
            momoCheckpoint(params.reference, `${name}-closed`, "completed"),
          ),
        );
      await deps.realtime.publish(params.orgId, result.storeId, result.envelope);
      return result;
    });
  try {
    const deadline = await flow.step("deadline", policy, () =>
      deps.withDatabase((db) =>
        recordMomoDeadline(
          db,
          context,
          {
            reference: params.reference,
            deadline: (deps.now ?? Date.now)() + (deps.timeoutMs ?? 180_000),
          },
          momoCheckpoint(params.reference, "deadline", "waiting"),
        ),
      ),
    );
    const initial = await read();
    if (["confirmed", "failed", "expired"].includes(initial.status)) {
      await perform("already-settled", async () => ({ status: initial.status }));
      return;
    }
    // Resolved at each call: deps are the shell's live clients.
    const providerOf = () => (initial.provider === "hubtel" ? deps.hubtel : deps.paystack);
    const provider = providerOf();
    let state = await perform("charge", async () =>
      !provider
        ? {
            status: "failed" as const,
            message: "Hubtel is not set up for this shop. Pay another way.",
          }
        : provider.charge({
            reference: params.reference,
            amount: initial.amount,
            phone: params.phone,
            network: initial.network,
            email: params.email,
          }),
    );
    let index = 0;
    while (!["confirmed", "failed", "expired"].includes(state.status)) {
      try {
        const event = v.parse(
          momoEvent,
          await flow.waitFor(
            `event-${index}`,
            "payment",
            Math.max(0, deadline.deadline - (deps.now ?? Date.now)()),
          ),
        );
        if (event.type === "settled") {
          await perform("settled", async () => ({ status: (await read()).status }));
          return;
        }
        // Only Paystack asks for an OTP; Hubtel payers approve on the phone.
        if (state.status === "otp")
          state = await perform(`otp-${index}`, () =>
            deps.paystack.submitOtp({ reference: params.reference, otp: event.otp }),
          );
        index++;
      } catch (error) {
        if (!(error instanceof WorkflowTimeoutError)) throw error;
        await perform(
          "verify",
          async () => {
            const verified = await (providerOf() ?? deps.paystack).verify(params.reference);
            // Hubtel reports what it collected; money short of the intent never becomes a paid tender.
            if (
              "amount" in verified &&
              verified.amount !== undefined &&
              verified.amount !== initial.amount
            )
              return {
                status: "failed" as const,
                providerReference: verified.providerReference,
                message: "Hubtel collected a different amount. Check the Hubtel dashboard.",
              };
            return {
              ...verified,
              status: ["pending", "otp"].includes(verified.status) ? "expired" : verified.status,
            };
          },
          1,
        );
        return;
      }
    }
  } catch (error) {
    await flow.step("interrupted", policy, async () => {
      const saved = await deps.withDatabase((db) =>
        updateMomo(
          db,
          context,
          {
            reference: params.reference,
            status: "expired",
            message: "Payment outcome is uncertain. Check its status before retrying.",
          },
          momoCheckpoint(params.reference, "interrupted", "failed"),
        ),
      );
      await deps.realtime.publish(params.orgId, saved.storeId, saved.envelope);
      return saved;
    });
    throw error;
  }
}
