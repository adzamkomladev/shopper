import type * as v from "valibot";
import type { tillConfiguration } from "../schemas/till/config";

export type TillConfig = v.InferOutput<typeof tillConfiguration> & { now?: () => Date };
