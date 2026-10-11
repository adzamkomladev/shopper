import * as v from "valibot";

export const integer = v.pipe(v.number(), v.safeInteger());
export const moneySchema = v.pipe(integer, v.brand("Money"));
export type Money = v.InferOutput<typeof moneySchema>;
