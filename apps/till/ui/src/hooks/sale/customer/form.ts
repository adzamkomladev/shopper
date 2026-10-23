import { useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import {
  draftOf,
  fieldsOf,
  normalPhone,
  phoneProblem,
  problemsOf,
  showsTin,
  type CustomerDraft,
  type CustomerField,
  type Problems,
} from "../../../schemas/customer";
import type { BasketCustomer, CustomerRecord } from "../../../sale/customer/types";
import type { SaleActions } from "../../../sale/types";
import type { CustomerMode } from "./types";

type Lookup = { phone: string } & (
  | { status: "loading" }
  | { status: "ready"; customers: CustomerRecord[] }
  | { status: "failed"; message: string }
);
type Props = {
  mode: CustomerMode;
  /** The customer on the basket, for Alt+E. */
  attached: BasketCustomer | null;
  canWrite: boolean;
  actions: Pick<SaleActions, "findCustomers" | "saveCustomer" | "attachCustomer">;
  onDone: () => void;
};

const fieldOrder: CustomerField[] = ["phone", "name", "businessName", "tin"];

/**
 * The customer dialog's one job in three steps: look a number up, pick who it is (or fill in a new customer),
 * and put them on the sale. Edit skips the lookup. `Create invoice` asks for a TIN before it attaches anyone.
 */
export function useCustomerForm({ mode, attached, canWrite, actions, onDone }: Props) {
  const invoice = mode === "invoice";
  const editing = mode === "edit";
  const formRef = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<CustomerDraft>(() =>
    editing && attached
      ? draftOf(attached)
      : {
          phone: "",
          name: "",
          kind: invoice ? "business" : "individual",
          businessName: "",
          tin: "",
        },
  );
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [active, setActive] = useState(0);
  // A customer picked for an invoice who has no TIN yet: the form opens on theirs.
  const [fixing, setFixing] = useState<BasketCustomer | null>(null);
  const [problems, setProblems] = useState<Problems>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const hadTin = Boolean((editing ? attached : fixing)?.tin);
  const tinShown = showsTin(draft, invoice, hadTin);

  const typed = normalPhone(draft.phone);
  const settled = !editing && lookup?.phone === typed ? lookup : null;
  const customers = settled?.status === "ready" ? settled.customers : [];
  const target = editing ? attached : fixing;
  const noMatch = settled?.status === "ready" && customers.length === 0;
  const formShown = editing || fixing !== null || (noMatch && canWrite);

  function change(next: Partial<CustomerDraft>) {
    setDraft({ ...draft, ...next });
    setFailure(null);
    setProblems((current) => {
      const rest = { ...current };
      for (const key of Object.keys(next) as CustomerField[]) delete rest[key];
      return rest;
    });
  }
  function onPhone(event: ChangeEvent<HTMLInputElement>) {
    change({ phone: event.target.value });
    setActive(0);
  }

  async function search() {
    const problem = phoneProblem(draft.phone);
    if (problem) return setProblems({ phone: problem });
    const phone = normalPhone(draft.phone)!;
    setProblems({});
    setFailure(null);
    setLookup({ phone, status: "loading" });
    const result = await actions.findCustomers(phone);
    // A newer number may have been looked up since; only the latest answer is shown.
    setLookup((now) =>
      now?.phone !== phone
        ? now
        : result.ok
          ? { phone, status: "ready", customers: result.customers }
          : { phone, status: "failed", message: result.message },
    );
  }

  async function attach(customerId: string) {
    const outcome = await actions.attachCustomer(customerId);
    setSaving(false);
    if (outcome.ok) onDone();
    else setFailure(outcome.message);
  }

  function choose(customer: CustomerRecord) {
    if (invoice && !customer.tin) {
      setFixing(customer);
      return setDraft({ ...draftOf(customer), tin: "" });
    }
    setSaving(true);
    void attach(customer.id);
  }

  async function save() {
    const found = problemsOf(draft, invoice, tinShown);
    setProblems(found);
    const first = fieldOrder.find((field) => found[field]);
    if (first) return formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    setSaving(true);
    setFailure(null);
    const saved = await actions.saveCustomer(fieldsOf(draft, tinShown), target?.id);
    if (!saved.ok) {
      setSaving(false);
      return setFailure(saved.message);
    }
    // Attaching again also refreshes the chip after an edit.
    await attach(saved.customer.id);
  }

  /** Enter and Ctrl+Enter do the next thing: save the form, pick the highlighted customer, or look the number up. */
  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (saving) return;
    if (formShown) void save();
    else if (customers.length > 0) choose(customers[active]!);
    else void search();
  }
  function onKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") submit(event);
  }
  function onPhoneKeyDown(event: KeyboardEvent) {
    if (customers.length < 2 || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    setActive(Math.min(customers.length - 1, Math.max(0, active + step)));
  }

  return {
    formRef,
    draft,
    problems,
    failure,
    saving,
    invoice,
    editing,
    lookup: settled,
    customers,
    active,
    target,
    fixing,
    noMatch,
    formShown,
    tinShown,
    change,
    onPhone,
    onPhoneKeyDown,
    onKeyDown,
    submit,
    choose,
    setActive,
  };
}
