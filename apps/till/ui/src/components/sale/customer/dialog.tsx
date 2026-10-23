import { CloudOff } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shopper/ui/components/dialog";
import { Kbd } from "@shopper/ui/components/kbd";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { useCustomerForm } from "../../../hooks/sale/customer/form";
import type { CustomerControls, CustomerForm } from "../../../hooks/sale/customer/types";
import { displayName, spacedPhone } from "../../../sale/customers";
import type { SaleActions } from "../../../sale/types";
import { CustomerFields, PhoneField } from "./form";
import { CustomerResults } from "./results";

const titles = {
  attach: "Add customer",
  invoice: "Create invoice",
  edit: "Edit customer",
} as const;
const helps = {
  attach: "Find them by phone number, or add them now. They join this sale.",
  invoice:
    "An invoice names the customer and their TIN. Find them by phone number, or add them now.",
  edit: "Changes apply to this sale and every later one.",
} as const;

/** Add customer (Alt+U), Create invoice (Alt+I) and Edit customer (Alt+E): one dialog, three ways in. */
export function CustomerDialog({
  controls,
  actions,
  onReturnFocus,
}: {
  controls: CustomerControls;
  actions: SaleActions;
  onReturnFocus: () => void;
}) {
  const { mode } = controls;
  return (
    <Dialog onOpenChange={(open) => !open && controls.close()} open={mode !== null}>
      <DialogContent
        aria-describedby="customer-help"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
        showCloseButton={false}
      >
        {mode && <CustomerPanel actions={actions} controls={controls} key={mode} mode={mode} />}
      </DialogContent>
    </Dialog>
  );
}

/** Mounted with the dialog, so closing it drops the number, the matches and the half-typed form. */
function CustomerPanel({
  mode,
  controls,
  actions,
}: {
  mode: NonNullable<CustomerControls["mode"]>;
  controls: CustomerControls;
  actions: SaleActions;
}) {
  const form = useCustomerForm({
    mode,
    attached: controls.customer,
    canWrite: controls.canWrite,
    actions,
    onDone: controls.close,
  });
  const { lookup, noMatch, formShown, customers } = form;
  return (
    <form
      className="grid gap-4"
      noValidate
      onKeyDown={form.onKeyDown}
      onSubmit={form.submit}
      ref={form.formRef}
    >
      <DialogHeader>
        <DialogTitle>{titles[mode]}</DialogTitle>
        <DialogDescription id="customer-help">{helps[mode]}</DialogDescription>
      </DialogHeader>
      <PhoneField form={form} />
      {lookup?.status === "loading" && (
        // One result's height, so the answer lands where the placeholder was.
        <div role="status">
          <span className="sr-only">Looking up {spacedPhone(lookup.phone)}</span>
          <Skeleton aria-hidden="true" className="h-16 rounded-xl" />
        </div>
      )}
      {lookup?.status === "failed" && (
        <div className="grid gap-1 text-sm" role="alert">
          <p className="font-medium text-destructive">{lookup.message}</p>
          <p className="text-muted-foreground">Press Enter to try again.</p>
        </div>
      )}
      {customers.length > 0 && !formShown && <CustomerResults form={form} />}
      {noMatch && !formShown && (
        <p className="text-sm" role="status">
          <span className="font-medium">No customer uses this number.</span>{" "}
          <span className="text-muted-foreground">
            You don't have permission to add customers. Ask a manager.
          </span>
        </p>
      )}
      {noMatch && formShown && (
        <p className="text-sm font-medium" role="status">
          No customer uses this number
          <span className="font-normal text-muted-foreground">. Add them now.</span>
        </p>
      )}
      {formShown && <CustomerFields form={form} />}
      {controls.offline && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground" role="status">
          <CloudOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {form.editing
            ? "Changes upload when the register reconnects."
            : "New customers upload when the register reconnects."}
        </p>
      )}
      {form.failure && (
        <p className="text-sm font-medium text-destructive" role="alert">
          {form.failure}
        </p>
      )}
      <DialogFooter>
        <Button onClick={controls.close} size="touch" type="button" variant="outline">
          Cancel <Kbd>Esc</Kbd>
        </Button>
        <Button disabled={form.saving} size="touch" type="submit">
          {submitLabel(form)} <Kbd>{formShown ? "Ctrl+Enter" : "Enter"}</Kbd>
        </Button>
      </DialogFooter>
    </form>
  );
}

function submitLabel(form: CustomerForm) {
  if (form.editing) return "Save changes";
  if (form.formShown) return form.fixing ? "Save and add to sale" : "Create and add to sale";
  const chosen = form.customers[form.active];
  return chosen ? `Add ${displayName(chosen)}` : "Find customer";
}
