import * as v from "valibot";

// Arkesel v2 answers a send with {"status": "success", "data": [...]}; anything else is a failure.
export const sendReplySchema = v.object({ status: v.string(), message: v.optional(v.string()) });
