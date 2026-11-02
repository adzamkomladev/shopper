import * as v from "valibot";

export const accountForm = v.object({
  code: v.pipe(v.string(), v.regex(/^[0-9]{4,6}$/, "Enter a code of 4 to 6 digits")),
  name: v.pipe(v.string(), v.trim(), v.minLength(1, "Enter the account's name")),
  type: v.picklist(["asset", "liability", "equity", "income", "expense"], "Pick a type"),
});
export type AccountForm = v.InferOutput<typeof accountForm>;

/** A cedi amount typed into a debit or credit cell: blank, or up to 2 decimals. */
export const cediText = v.pipe(v.string(), v.regex(/^(\d{1,9}(\.\d{0,2})?)?$/));
