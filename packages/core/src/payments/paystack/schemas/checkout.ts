import * as v from "valibot";

export const checkoutResponseSchema = v.object({
  status: v.literal(true),
  data: v.object({ authorization_url: v.pipe(v.string(), v.url()), reference: v.string() }),
});
