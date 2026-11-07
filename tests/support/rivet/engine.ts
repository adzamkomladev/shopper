import { randomUUID } from "node:crypto";

/** The Rivet engine the suites run against: compose locally, the `rivet` service in CI. */
export const rivetEngine = {
  endpoint: process.env.RIVET_ENDPOINT ?? "http://127.0.0.1:6420",
  token: process.env.RIVET_TOKEN ?? "shopper_local_development_only",
  namespace: process.env.RIVET_NAMESPACE ?? "default",
};

/** A pool of its own, so actors started here never run in another test process. */
export const rivetPool = () => `test-${randomUUID().slice(0, 8)}`;
