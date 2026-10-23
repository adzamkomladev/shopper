import type { useCustomerControls } from "./controls";
import type { useCustomerForm } from "./form";

export type CustomerMode = "attach" | "invoice" | "edit";
export type CustomerControls = ReturnType<typeof useCustomerControls>;
export type CustomerForm = ReturnType<typeof useCustomerForm>;
