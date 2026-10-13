import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

export const tillId = v.pipe(
  uuidV7Schema,
  v.transform((value) => value.toLowerCase()),
);
