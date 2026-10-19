import { Button } from "@shopper/ui/components/button";
import { Field, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input/control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shopper/ui/components/select";
import { Skeleton } from "@shopper/ui/components/skeleton";
import type { useApprovalForm } from "../../hooks/approval/form";
import type { ApprovalPermission, ApproverState } from "../../sale/types";

/**
 * A manager and their PIN, inside the dialog that needs them; Enter in the PIN field submits that dialog's
 * form. `permission` is what the manager must be allowed to approve.
 */
export function ApprovalFields({
  approvers,
  permission,
  form,
  onRetry,
}: {
  approvers: ApproverState;
  permission: ApprovalPermission;
  form: ReturnType<typeof useApprovalForm>;
  onRetry: () => void;
}) {
  // A list for another action, or none yet, is the same as still loading.
  const status =
    approvers.permission !== permission || approvers.status === "idle"
      ? "loading"
      : approvers.status;
  if (status === "loading")
    return (
      <div className="grid gap-2" role="status">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-11 w-full" />
        <span className="sr-only">Loading managers</span>
      </div>
    );
  if (status === "failed")
    return (
      <div className="grid justify-items-start gap-2 text-sm" role="status">
        <p>Managers could not be loaded.</p>
        <Button onClick={onRetry} size="touch" type="button" variant="outline">
          Try again
        </Button>
      </div>
    );
  if (approvers.stale || approvers.approvers.length === 0)
    return (
      <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground" role="status">
        {approvers.stale
          ? "The manager list is out of date. Connect to refresh it."
          : "Connect to load manager approvals"}
      </p>
    );
  return (
    <>
      <Field>
        <FieldLabel htmlFor="approval-manager">Manager</FieldLabel>
        <Select onValueChange={form.setApprover} value={form.approverId}>
          <SelectTrigger className="w-full" id="approval-manager" size="touch">
            <SelectValue placeholder="Choose a manager" />
          </SelectTrigger>
          <SelectContent position="popper">
            {approvers.approvers.map((approver) => (
              <SelectItem key={approver.userId} value={approver.userId}>
                {approver.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field data-invalid={form.pinError ? "true" : undefined}>
        <FieldLabel htmlFor="approval-pin">Manager PIN</FieldLabel>
        <Input
          aria-describedby={form.pinError ? "approval-pin-error" : undefined}
          aria-invalid={form.pinError ? true : undefined}
          autoComplete="off"
          id="approval-pin"
          inputMode="numeric"
          maxLength={8}
          onChange={(event) => form.setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
          ref={form.pinRef}
          touch
          type="password"
          value={form.pin}
        />
        {form.pinError && <FieldError id="approval-pin-error">{form.pinError}</FieldError>}
      </Field>
    </>
  );
}
