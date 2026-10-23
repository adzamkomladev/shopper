import type * as v from "valibot";
import type { customerView } from "../../schemas/customers/view";

export type CustomerView = v.InferOutput<typeof customerView>;
/** What the list filters to: all active customers, only businesses, or the archived. */
export type CustomersSearch = { q?: string; segment?: "business" | "archived" };
