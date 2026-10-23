import { useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { formatGHS, money } from "@shopper/money";
import { toast } from "@shopper/ui/components/sonner";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { normalPhone, phoneProblem } from "../../schemas/customer";
import type { PaymentActions } from "../../sale/account/types";
import type { CustomerRecord } from "../../sale/customer/types";
import { displayName } from "../../sale/customers";
import { cedisText, parseCedis } from "../../shift/amount";
import type { Owed } from "./types";

type Lookup = { phone: string } & (
  | { status: "loading" }
  | { status: "ready"; customers: CustomerRecord[] }
  | { status: "failed"; message: string }
);

/**
 * Take account payment in two steps: find the customer by phone, then enter the amount. Cash is taken anywhere;
 * MoMo and the balance need the server (`online`). The dialog mounts this, so closing it drops everything typed.
 */
export function useAccountPayment({
  actions,
  online,
  onDone,
}: {
  actions: PaymentActions;
  online: boolean;
  onDone: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [active, setActive] = useState(0);
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [owed, setOwed] = useState<Owed>({ status: "loading" });
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "momo">("cash");
  const [reference, setReference] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const typed = normalPhone(phone);
  const settled = lookup?.phone === typed ? lookup : null;
  const customers = settled?.status === "ready" ? settled.customers : [];
  // Back at the drawer with no network, MoMo cannot be chosen, so a leftover choice reads as cash.
  const how = online ? method : "cash";
  const value = parseCedis(amount);
  const ready = value !== null && value > 0 && (how === "cash" || reference.trim() !== "");
  const block = !customer
    ? null
    : value === null || value <= 0
      ? "Enter the amount paid, more than GH₵ 0.00"
      : how === "momo" && reference.trim() === ""
        ? "Enter the MoMo reference"
        : null;

  async function search() {
    const problem = phoneProblem(phone);
    if (problem) return setProblem(problem);
    const number = normalPhone(phone)!;
    setProblem(null);
    setLookup({ phone: number, status: "loading" });
    const result = await actions.find(number);
    setLookup((now) =>
      now?.phone !== number
        ? now
        : result.ok
          ? { phone: number, status: "ready", customers: result.customers }
          : { phone: number, status: "failed", message: result.message },
    );
  }

  async function choose(next: CustomerRecord) {
    setCustomer(next);
    if (!online) return setOwed({ status: "offline" });
    setOwed({ status: "loading" });
    const read = await actions.owed(next.id);
    setOwed(read.ok ? { status: "ready", account: read.account } : { status: "failed" });
  }

  async function pay() {
    if (!customer || !ready || pending) return;
    setPending(true);
    setFailure(null);
    const outcome = await actions.pay({
      customerId: customer.id,
      method: how,
      amount: value!,
      ...(how === "momo" ? { reference: reference.trim() } : {}),
    });
    setPending(false);
    if (!outcome.ok) return setFailure(outcome.message);
    toast.success(`Took ${formatGHS(money(value!))} from ${displayName(customer)}`, {
      description: outcome.printed
        ? "Slip printed"
        : "Slip not printed. Print it again from the customer",
    });
    onDone();
  }

  function submit() {
    if (pending) return;
    if (customer) void pay();
    else if (customers.length > 0) void choose(customers[active]!);
    else void search();
  }

  return {
    phone,
    problem,
    lookup: settled,
    customers,
    active,
    customer,
    owed,
    amount,
    method: how,
    reference,
    pending,
    failure,
    block,
    online,
    setActive,
    choose,
    setMethod,
    setReference,
    /** A different customer: back to the number, keeping what was typed there. */
    change: () => {
      setCustomer(null);
      setFailure(null);
    },
    onPhone: (event: ChangeEvent<HTMLInputElement>) => {
      setPhone(event.target.value);
      setProblem(null);
      setActive(0);
    },
    onPhoneKeyDown: (event: KeyboardEvent) => {
      if (customers.length < 2 || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
      event.preventDefault();
      setActive(
        Math.min(customers.length - 1, Math.max(0, active + (event.key === "ArrowDown" ? 1 : -1))),
      );
    },
    onAmount: (event: ChangeEvent<HTMLInputElement>) => {
      setAmount(cedisText(event.target.value));
      setFailure(null);
    },
    onSubmit: (event: FormEvent) => {
      event.preventDefault();
      submit();
    },
    shortcuts: useShortcuts({ "Mod+Enter": submit }),
  };
}
