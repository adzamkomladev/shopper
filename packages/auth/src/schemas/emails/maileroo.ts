import * as v from "valibot";
export const mailAddress = v.pipe(v.string(), v.email());

export const mailResponse = v.object({ success: v.literal(true) });
