import * as v from "valibot";

export const signedIn = v.object({ user: v.object({ id: v.string() }) });
