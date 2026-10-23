import * as v from "valibot";
import { fromDecimal } from "@shopper/money";

const cedis = v.pipe(
  v.string(),
  v.trim(),
  v.check((value) => {
    try {
      fromDecimal(value);
      return true;
    } catch {
      return false;
    }
  }, "Enter an amount like 12.50"),
  v.transform(fromDecimal),
);
const positive = v.pipe(
  cedis,
  v.check((value) => value > 0, "The amount must be more than 0"),
);
const reason = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty("Give a reason"),
  v.maxLength(500, "Keep it shorter"),
);

export const paymentSchema = v.object({ method: v.picklist(["cash", "momo"]), amount: positive });
export const noteSchema = v.object({ amount: positive, reason });
export const limitSchema = v.object({
  creditLimit: v.pipe(
    cedis,
    v.check((value) => value >= 0, "The limit can't be below 0"),
  ),
});
/** Points to another customer, no more than `available` (the server holds the final say). */
export const transferSchema = (available: number) =>
  v.pipe(
    v.object({
      toId: v.pipe(v.string(), v.nonEmpty("Choose who gets the points")),
      points: v.pipe(
        v.string(),
        v.trim(),
        v.regex(/^[1-9]\d*$/, "Enter a whole number of points"),
        v.transform(Number),
        v.safeInteger("Enter a whole number of points"),
      ),
      reason,
    }),
    v.forward(
      v.check((t) => t.points <= available, `They only have ${available} points`),
      ["points"],
    ),
  );

export const emptyPayment = { method: "cash", amount: "" };
export const emptyNote = { amount: "", reason: "" };
export const emptyTransfer = { toId: "", points: "", reason: "" };
