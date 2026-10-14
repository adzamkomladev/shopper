import * as v from "valibot";
import { categoryView } from "@shopper/core/schemas";

export const categoryList = v.array(categoryView);
