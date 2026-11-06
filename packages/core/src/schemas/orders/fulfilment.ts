import * as v from "valibot";

const clock = v.pipe(v.string(), v.regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Use a time like 08:00"));

/** How a branch hands over online orders, as the back office edits it. */
export const fulfilmentInput = v.pipe(
  v.object({
    pickup: v.boolean(),
    delivery: v.boolean(),
    deliveryFee: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(10_000_000_000)),
    opens: clock,
    closes: clock,
    slotMinutes: v.picklist([30, 60, 120]),
    slotCapacity: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(500)),
    leadMinutes: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(2880)),
  }),
  v.forward(
    v.check((input) => input.closes > input.opens, "Closing must be after opening"),
    ["closes"],
  ),
);
