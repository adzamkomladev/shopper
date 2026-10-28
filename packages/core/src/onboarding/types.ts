import type { setupSteps } from "./queries";

/** One step of the setup wizard. */
export type SetupStep = (typeof setupSteps)[number];
