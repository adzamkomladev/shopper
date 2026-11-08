import { useState } from "react";
import { Button } from "@shopper/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shopper/ui/components/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input";

/** Tonight at 23:00 on the box's clock, or tomorrow's when that has passed: a time after closing for most shops. */
function afterClosing() {
  const at = new Date();
  at.setHours(23, 0, 0, 0);
  if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: string;
  pending: boolean;
  onSchedule: (at: string) => void;
};

/** Install after closing: pick the time; the box makes its backup then, and restarts. */
export function ScheduleDialog({ open, onOpenChange, version, pending, onSchedule }: Props) {
  const [value, setValue] = useState(afterClosing);
  const at = new Date(value);
  const error =
    Number.isNaN(at.getTime()) || at.getTime() <= Date.now()
      ? "Pick a time that has not passed"
      : undefined;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!error) onSchedule(at.toISOString());
          }}
        >
          <DialogHeader>
            <DialogTitle>Install {version} after closing</DialogTitle>
            <DialogDescription>
              The box makes a verified backup at that time, then restarts. Tills keep selling.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="update-at">Install at</FieldLabel>
            <Input
              id="update-at"
              type="datetime-local"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              aria-invalid={!!error}
            />
            {error ? (
              <FieldError>{error}</FieldError>
            ) : (
              <FieldDescription>Tonight at 23:00 unless you change it.</FieldDescription>
            )}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!!error || pending}>
              Schedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
