import * as v from "valibot";
import { sequenceSchema } from "@shopper/ports";

export const nudge = v.object({ type: v.literal("store.changed"), sequence: sequenceSchema });
