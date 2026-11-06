import * as v from "valibot";
import { fulfilmentInput } from "@shopper/core/schemas";
import { fromDecimal, money, toDecimal } from "@shopper/money";

/** The branch's saved online ordering, as the API returns it. */
export const fulfilmentView = fulfilmentInput;
export type FulfilmentView = v.InferOutput<typeof fulfilmentInput>;

export const SLOT_OPTIONS = [
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "120", label: "2 hours" },
] as const;

/** The form edits text; the saved settings become its starting values. */
export const fulfilmentValues = (view: FulfilmentView) => ({
  pickup: view.pickup,
  delivery: view.delivery,
  deliveryFee: toDecimal(money(view.deliveryFee)),
  opens: view.opens,
  closes: view.closes,
  slotMinutes: String(view.slotMinutes),
  slotCapacity: String(view.slotCapacity),
  leadMinutes: String(view.leadMinutes),
});
export type FulfilmentValues = ReturnType<typeof fulfilmentValues>;

const whole = (min: number, max: number, message: string) =>
  v.pipe(
    v.string(),
    v.trim(),
    v.check((text) => /^\d+$/.test(text) && Number(text) >= min && Number(text) <= max, message),
  );
const fee = v.pipe(
  v.string(),
  v.trim(),
  v.check((text) => {
    try {
      return fromDecimal(text || "0") >= 0;
    } catch {
      return false;
    }
  }, "Enter a fee like 15.00"),
);

export const fulfilmentForm = v.pipe(
  v.object({
    pickup: v.boolean(),
    delivery: v.boolean(),
    deliveryFee: fee,
    opens: v.pipe(v.string(), v.nonEmpty("Choose when orders start")),
    closes: v.pipe(v.string(), v.nonEmpty("Choose when orders stop")),
    slotMinutes: v.string(),
    slotCapacity: whole(1, 500, "Enter between 1 and 500 orders"),
    leadMinutes: whole(0, 2880, "Enter between 0 and 2880 minutes"),
  }),
  v.forward(
    v.check((values) => values.closes > values.opens, "Closing must be after opening"),
    ["closes"],
  ),
);

export const toFulfilmentBody = (values: FulfilmentValues) => ({
  pickup: values.pickup,
  delivery: values.delivery,
  deliveryFee: fromDecimal(values.deliveryFee.trim() || "0"),
  opens: values.opens,
  closes: values.closes,
  slotMinutes: Number(values.slotMinutes),
  slotCapacity: Number(values.slotCapacity),
  leadMinutes: Number(values.leadMinutes),
});
