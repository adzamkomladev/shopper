import type { HostStatus } from "@shopper/sync/bridge";
import type { SaleRegister } from "./types";

/** The settings and printer status the completion view reads; null until the host has answered. */
export const registerOf = (status: HostStatus | null): SaleRegister | null =>
  status && {
    clearCartAfterSale: status.settings.value.clearCartAfterSale,
    printAutomatically: status.settings.value.printAutomatically,
    printer: status.printer,
  };
