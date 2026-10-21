import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Field, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input/control";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { takeFocus } from "../../../hooks/focus";
import type { useCloseForm } from "../../../hooks/shift/close";
import { cedisText } from "../../../shift/amount";
import { nextOnEnter } from "../../../shift/keys";
import { CountGrid, CountTotal } from "../count/grid";
import { Stepper } from "./stepper";

const card = "rounded-lg border bg-card shadow-sm";

/** Steps one and two of the close: nothing expected is on this page, so the count is the cashier's own. */
export function CloseFlow({
  form,
  active,
  onCancel,
}: {
  form: ReturnType<typeof useCloseForm>;
  active: boolean;
  onCancel: () => void;
}) {
  const totals = form.step === "totals";
  const register = useShortcuts(
    active
      ? {
          "Mod+Enter": () => (totals ? void form.declare() : form.next()),
          Escape: (event) => {
            // Escape that closes an open list is not ours.
            if (event.target instanceof Element && event.target.closest("[role=listbox]")) return;
            if (totals) form.back();
            else onCancel();
          },
        }
      : {},
  );
  return (
    <section
      aria-label="Close shift"
      className="grid gap-4 outline-none"
      ref={(node) => {
        const cleanup = register(node);
        takeFocus(node, active);
        return cleanup;
      }}
      tabIndex={-1}
    >
      <div className={`${card} flex flex-wrap items-center justify-between gap-4 p-4`}>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Close shift</h2>
          <p className="text-sm text-muted-foreground">
            Count what is in the drawer and read the terminal totals. The register shows its own
            figures after you submit.
          </p>
        </div>
        <Stepper current={totals ? 1 : 0} />
      </div>
      <form
        className={`${card} grid gap-4 p-4`}
        noValidate
        onKeyDown={nextOnEnter}
        onSubmit={(event) => {
          event.preventDefault();
          if (totals) void form.declare();
          else form.next();
        }}
      >
        {totals ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <TotalField
              autoFocus
              id="close-card"
              label="Card terminal total (GH₵)"
              onChange={form.setCard}
              value={form.card}
            />
            <TotalField
              id="close-momo"
              label="MoMo terminal total (GH₵)"
              onChange={form.setMomo}
              value={form.momo}
            />
          </div>
        ) : (
          <CountGrid onChange={form.setCount} values={form.counts} />
        )}
        <div className="sticky bottom-0 -mx-4 -mb-4 grid gap-3 rounded-b-lg border-t bg-card px-4 py-3">
          {!totals && <CountTotal values={form.counts} />}
          {form.problem && <FieldError role="alert">{form.problem}</FieldError>}
          {form.block && (
            <p className="text-sm text-muted-foreground" id="close-block">
              {form.block}
            </p>
          )}
          {totals && (
            <p className="text-sm font-medium">
              Submitting makes this count final. There is no recount.
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              aria-keyshortcuts="Escape"
              onClick={totals ? form.back : onCancel}
              size="touch"
              type="button"
              variant="outline"
            >
              <ArrowLeft aria-hidden="true" />
              {totals ? "Back to count" : "Cancel"} <Kbd className="max-sm:hidden">Esc</Kbd>
            </Button>
            <Button
              aria-describedby={form.block ? "close-block" : undefined}
              aria-keyshortcuts="Control+Enter"
              disabled={!!form.block || form.pending}
              size="touch"
              type="submit"
            >
              {form.pending ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <ArrowRight aria-hidden="true" />
              )}
              {totals ? "Submit count" : "Next: Card & MoMo"}{" "}
              <Kbd className="max-sm:hidden">Ctrl+Enter</Kbd>
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

function TotalField({
  id,
  label,
  value,
  autoFocus,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  autoFocus?: boolean;
  onChange: (text: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        autoComplete="off"
        autoFocus={autoFocus}
        id={id}
        inputMode="decimal"
        onChange={(event) => onChange(cedisText(event.target.value))}
        touch
        value={value}
      />
    </Field>
  );
}
