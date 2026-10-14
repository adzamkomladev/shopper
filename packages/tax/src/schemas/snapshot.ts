import * as v from "valibot";

export const priceModeSchema = v.picklist(["inclusive", "exclusive"]);

export const quantitySchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
