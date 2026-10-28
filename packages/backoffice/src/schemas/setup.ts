import * as v from "valibot";

/** The wizard's steps in order, as the API reads them from the shop's rows; Done closes it. */
export const setupSteps = ["store", "branch", "tax", "products", "team", "till"] as const;
const step = v.picklist(setupSteps);

export const setup = v.object({
  steps: v.array(v.object({ step, done: v.boolean() })),
  next: v.nullable(step),
  status: v.nullable(v.picklist(["setup", "trading"])),
  skipped: v.boolean(),
  finished: v.boolean(),
  firstSaleAt: v.nullable(v.string()),
});
export type Setup = v.InferOutput<typeof setup>;
export type SetupStep = (typeof setupSteps)[number] | "done";

/** The step on screen, kept in the address; left out, the first one not done. */
export const setupSearch = v.object({ step: v.optional(v.picklist([...setupSteps, "done"])) });
