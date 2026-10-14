import { verificationDispatchResult } from "../schemas/onboarding/service";
import type { OnboardingOptions } from "./types";
export type { OnboardingOptions } from "./types";
import * as v from "valibot";
import { v7 } from "uuid";
import { buildInfo } from "@shopper/config";
import { and, desc, eq, like } from "drizzle-orm";
import { registrationWorkflowStep } from "@shopper/db-pg";

import { signalAuthCompletion } from "../flows/completion";
import { constantTimeEqual } from "../session/http";
import { createLinkToken, linkDigest, AuthLinkError } from "../links/tokens";
import {
  registrationStartSchema,
  registrationVerifySchema,
  registrationCompleteSchema,
  registrationResendSchema,
  registrationPreviewSchema,
} from "../schemas/onboarding";
import {
  completeRegistration,
  registrationFor,
  registrationView,
  startRegistration,
  verifyRegistration,
} from "./commands";

export function createOnboarding(options: OnboardingOptions) {
  if (options.linkSecret.length < 32) throw new Error("Link secret must be at least 32 characters");
  const now = options.now ?? Date.now;
  const context = (id: string) => ({ orgId: id.toLowerCase(), appVersion: buildInfo.version });
  return {
    async start(raw: unknown) {
      const data = v.parse(registrationStartSchema, raw);
      const id = v7();
      const digest = await linkDigest(
        await createLinkToken(options.linkSecret, "registration", id),
      );
      const result = await startRegistration(
        options.database,
        context(id),
        { data, digest, expiresAt: new Date(now() + 86_400_000), launcher: options.launcher },
        { instanceId: id, businessKey: id, type: "registration", step: "start", status: "waiting" },
      );
      return {
        ...result,
        deliveryStatus: "pending" as const,
        resendToken: await createLinkToken(options.linkSecret, "registration-resend", id),
      };
    },
    async get(raw: unknown) {
      const data = v.parse(registrationPreviewSchema, raw);
      let token: string;
      if ("resendToken" in data) {
        if (
          !constantTimeEqual(
            data.resendToken,
            await createLinkToken(options.linkSecret, "registration-resend", data.id),
          )
        )
          throw new AuthLinkError("This link is invalid or expired", 410);
        token = await createLinkToken(options.linkSecret, "registration", data.id);
      } else token = data.token;
      const row = await options.database.transaction((tx) =>
        registrationFor(tx, data.id.toLowerCase(), token, now()),
      );
      const [delivery] = await options.database
        .select({ output: registrationWorkflowStep.output })
        .from(registrationWorkflowStep)
        .where(
          and(
            eq(registrationWorkflowStep.orgId, row.id),
            like(registrationWorkflowStep.name, "delivery-%"),
          ),
        )
        .orderBy(desc(registrationWorkflowStep.createdAt))
        .limit(1);
      const status = v.safeParse(verificationDispatchResult, delivery?.output);
      return {
        ...registrationView(row),
        deliveryStatus: status.success
          ? status.output.sent
            ? ("sent" as const)
            : ("failed" as const)
          : ("pending" as const),
      };
    },
    async verify(raw: unknown) {
      const data = v.parse(registrationVerifySchema, raw);
      return verifyRegistration(options.database, context(data.id), {
        token: data.token,
        now: now(),
      });
    },
    async complete(raw: unknown) {
      const data = v.parse(registrationCompleteSchema, raw);
      const result = await completeRegistration(options.database, context(data.id), {
        data,
        now: now(),
      });
      await signalAuthCompletion(options, { id: data.id.toLowerCase(), purpose: "registration" });
      return result;
    },
    async resend(raw: unknown) {
      const data = v.parse(registrationResendSchema, raw);
      if (
        !constantTimeEqual(
          data.resendToken,
          await createLinkToken(options.linkSecret, "registration-resend", data.id),
        )
      )
        throw new AuthLinkError("This link is invalid or expired", 410);
      const token = await createLinkToken(options.linkSecret, "registration", data.id);
      await options.database.transaction((tx) =>
        registrationFor(tx, data.id.toLowerCase(), token, now()),
      );
      await options.launcher.send(data.id.toLowerCase(), "auth-action", { action: "retry" });
      return { id: data.id.toLowerCase() };
    },
  };
}
