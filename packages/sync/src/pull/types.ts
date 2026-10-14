import { type PullStatus } from "../schemas/pull/worker";
import type { PushOptions } from "../push/types";

export type PullOptions = Omit<PushOptions, "onStatus"> & {
  onStatus?: (s: PullStatus) => void;
  retry?: boolean;
};
