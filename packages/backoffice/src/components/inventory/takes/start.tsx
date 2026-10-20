import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlertIcon } from "lucide-react";
import { v7 } from "uuid";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shopper/ui/components/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { Kbd } from "@shopper/ui/components/kbd";
import { RadioGroup, RadioGroupItem } from "@shopper/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shopper/ui/components/select";
import { takeProblem } from "../../../lib/inventory/takes";
import { categoriesQuery } from "../../../queries/catalogue/list";
import { takesListQuery, useStartTake } from "../../../queries/inventory/takes";

type Scope = "full" | "category";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  branchName: string;
  onStarted: (takeId: string) => void;
};

/** Full or one category, then Enter: the choice that opens a count sheet. */
export function StartTakeDialog({ open, onOpenChange, ...props }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Opened by N there is no button to return to, so focus goes to the page heading.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById("inventory-heading")?.focus();
        }}
      >
        <StartForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function StartForm({ branchId, branchName, onStarted }: Omit<Props, "open" | "onOpenChange">) {
  // One id per time the dialog is opened, so a retry after a failure is a replay and never a second take.
  const [id] = useState(() => v7());
  const [scope, setScope] = useState<Scope>("full");
  const [categoryId, setCategoryId] = useState("");
  const [missing, setMissing] = useState(false);
  const { data: categories = [], isSuccess } = useQuery(categoriesQuery());
  const noCategories = isSuccess && categories.length === 0;
  const start = useStartTake(onStarted);
  const problem = takeProblem(start.error);
  // The take that is open is in the list this page was opened from; it is read once, for the refusal's link.
  const openTakeId = useQueryClient()
    .getQueryData(takesListQuery(branchId).queryKey)
    ?.pages.flatMap((page) => page.items)
    .find((take) => take.status === "open")?.id;

  function submit() {
    if (start.isPending) return;
    if (scope === "category" && !categoryId) return setMissing(true);
    start.mutate({ id, branchId, scope, ...(scope === "category" && { categoryId }) });
  }
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          submit();
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>Start a stock take</DialogTitle>
        <DialogDescription>
          Count the stock at {branchName}. Sales can carry on while you count.
        </DialogDescription>
      </DialogHeader>
      <RadioGroup
        aria-label="What to count"
        value={scope}
        onValueChange={(next) => {
          setScope(next as Scope);
          start.reset();
        }}
        // Radios ignore Enter, so the dialog's own Enter starts the take.
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          submit();
        }}
      >
        <Choice value="full" label="Full count" hint="Every active product at this branch." />
        <Choice
          value="category"
          label="One category"
          hint={
            noCategories
              ? "Add a category to your products first."
              : "Only the products in the category you choose."
          }
          disabled={noCategories}
        />
      </RadioGroup>
      {scope === "category" && (
        <Field data-invalid={missing}>
          <FieldLabel htmlFor="take-category">Category</FieldLabel>
          <Select
            value={categoryId}
            onValueChange={(next) => {
              setCategoryId(next);
              setMissing(false);
            }}
          >
            <SelectTrigger
              id="take-category"
              className="w-full"
              aria-invalid={missing || undefined}
              aria-describedby={missing ? "take-category-error" : undefined}
            >
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {missing && <FieldError id="take-category-error">Choose a category to count</FieldError>}
        </Field>
      )}
      {problem && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden />
          <AlertTitle>
            {problem.kind === "open" ? "A take is already open here" : "Couldn't start the take"}
          </AlertTitle>
          <AlertDescription>
            <p>{problem.message}</p>
            {problem.kind === "open" && openTakeId && (
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link to="/stock/takes/$takeId" params={{ takeId: openTakeId }}>
                  Open the take
                </Link>
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
            <Kbd aria-hidden>Esc</Kbd>
          </Button>
        </DialogClose>
        <Button type="submit" disabled={start.isPending}>
          {start.isPending ? "Starting…" : "Start take"}
          {!start.isPending && (
            <Kbd aria-hidden className="bg-primary-foreground/5">
              ↵
            </Kbd>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

type ChoiceProps = { value: Scope; label: string; hint: string; disabled?: boolean };

function Choice({ value, label, hint, disabled }: ChoiceProps) {
  const id = `take-scope-${value}`;
  return (
    <div className="flex items-start gap-3">
      <RadioGroupItem value={value} id={id} disabled={disabled} className="mt-0.5" />
      <div className="flex flex-col gap-0.5">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription>{hint}</FieldDescription>
      </div>
    </div>
  );
}
