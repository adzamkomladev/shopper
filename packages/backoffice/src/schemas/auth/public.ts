import * as v from "valibot";

export const link = v.object({ id: v.optional(v.string()), token: v.optional(v.string()) });

export const invitationSearch = v.object({ ...link.entries, shop: v.optional(v.string()) });
