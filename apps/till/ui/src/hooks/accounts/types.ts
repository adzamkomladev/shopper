import type { AccountView } from "../../sale/account/types";
import type { useAccountPayment } from "./payment";

/** What the payment dialog knows of the balance: it is read from the server, so it can also be offline or lost. */
export type Owed =
  | { status: "loading" }
  | { status: "ready"; account: AccountView }
  | { status: "failed" }
  | { status: "offline" };
export type AccountPayment = ReturnType<typeof useAccountPayment>;
