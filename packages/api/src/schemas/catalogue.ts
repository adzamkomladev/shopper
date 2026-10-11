import * as v from "valibot";

// Price writes carry an audit reason alongside the price itself.
export const priceBody = v.looseObject({
  reason: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500)),
});
