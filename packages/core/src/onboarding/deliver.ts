import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import { org, user } from "@shopper/db-pg";
import type { Delivery, WorkflowLauncher } from "@shopper/ports";
import type { StatementDeliveryDeps } from "../customers";
import { readSetup } from "./queries";
import { ONBOARDING_WAKE, onboardingId } from "./records";
import { onboardingEventMessage, onboardingNudgeMessage } from "./schemas/base";
import type { SetupStep } from "./types";

type Deps = Pick<StatementDeliveryDeps, "db" | "mail" | "baseUrl"> & {
  onboarding?: WorkflowLauncher;
};

/** What a nudge asks for next, by the first step not done yet. */
const NEXT: Record<SetupStep | "sell", string> = {
  store: "Add your store, so Shopper knows where you sell.",
  branch: "Add a branch: each branch has its own tills and stock.",
  tax: "Enter your TIN and VAT details so receipts carry the right tax.",
  products: "Add your products, or import them from a spreadsheet.",
  team: "Invite your cashiers and managers.",
  till: "Download the till and enrol it with a code from the back office.",
  sell: "Everything is ready: ring up your first sale on the till.",
};

/** Wakes the shop's onboarding workflow after a mark commits; a shell without one (the box) has nothing to wake. */
export async function deliverOnboardingEvent(deps: Deps, delivery: Delivery) {
  const message = v.parse(onboardingEventMessage, delivery.message);
  await deps.onboarding?.send(onboardingId(delivery.message.orgId), ONBOARDING_WAKE, {
    mark: message.payload.mark,
  });
  await delivery.ack();
}

/** Emails one owner a nudge naming the next thing to do, with the way back into the setup wizard. */
export async function deliverOnboardingNudge(deps: Deps, delivery: Delivery) {
  const message = v.parse(onboardingNudgeMessage, delivery.message);
  if (!deps.mail || !deps.baseUrl) return await delivery.retry();
  const orgId = delivery.message.orgId;
  const [row] = await deps.db
    .select({ shop: org.name, email: user.email })
    .from(user)
    .innerJoin(org, eq(org.id, user.orgId))
    .where(and(eq(user.orgId, orgId), eq(user.id, message.payload.userId)));
  const setup = await readSetup(deps.db, orgId);
  // A shop that sold since the nudge was queued needs no nudge.
  if (!row || setup.firstSaleAt) return await delivery.ack();
  const link = `${deps.baseUrl.replace(/\/$/, "")}/setup`;
  const next = NEXT[setup.next ?? "sell"];
  await deps.mail({
    email: row.email,
    subject: setup.next
      ? `${row.shop}: finish setting up Shopper`
      : `${row.shop}: ready for your first sale`,
    link,
    plain: [`Next for ${row.shop}: ${next}`, "", `Pick up where you left off: ${link}`].join("\n"),
    attachments: [],
  });
  await delivery.ack();
}
