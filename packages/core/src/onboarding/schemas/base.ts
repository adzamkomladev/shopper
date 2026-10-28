import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

/** One shop's onboarding workflow, started at signup with the id the org will have. */
export const onboardingParams = v.object({ orgId: uuidV7Schema });

/** What a command marks on its way to trading: the first product or import, or the first accepted sale. */
export const onboardingMarks = ["catalogue", "first_sale"] as const;

/** Wakes the onboarding workflow after the mark's transaction commits. */
export const onboardingEventMessage = v.object({
  type: v.literal("onboarding.event"),
  payload: v.object({ mark: v.picklist(onboardingMarks) }),
});

/** One owner's nudge toward the first sale: the 1st, 2nd or 3rd. */
export const onboardingNudgeMessage = v.object({
  type: v.literal("onboarding.nudge"),
  payload: v.object({
    userId: uuidV7Schema,
    nudge: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(3)),
  }),
});
