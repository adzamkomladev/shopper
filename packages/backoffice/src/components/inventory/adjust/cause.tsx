import { Field, FieldDescription, FieldError, FieldLabel } from "@shopper/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shopper/ui/components/select";
import { entryId } from "../../../lib/inventory/entry";
import { CAUSES, CAUSE_LABELS } from "../../../lib/inventory/records";
import type { Cause, Direction } from "../../../lib/inventory/types";

type Props = {
  cause: Cause | "";
  direction: Direction | "";
  onCause: (cause: Cause) => void;
  onDirection: (direction: Direction) => void;
  causeError?: string;
  directionError?: string;
};

const HINTS: Record<Cause, string> = {
  damaged: "Wastage: the quantities are taken out of stock.",
  expired: "Wastage: the quantities are taken out of stock.",
  theft: "The quantities are taken out of stock.",
  found: "The quantities are added to stock.",
  other: "Say whether the quantities are added or removed.",
};

/** Why stock is changing. "Other" does not say which way, so it also asks for the direction. */
export function CauseFields({
  cause,
  direction,
  onCause,
  onDirection,
  causeError,
  directionError,
}: Props) {
  const causeId = entryId("cause");
  const directionId = entryId("direction");
  return (
    <>
      <Field data-invalid={!!causeError}>
        <FieldLabel htmlFor={causeId}>Cause</FieldLabel>
        <Select value={cause} onValueChange={(picked) => onCause(picked as Cause)}>
          <SelectTrigger
            id={causeId}
            className="w-full"
            aria-invalid={causeError ? true : undefined}
            aria-describedby={causeError ? `${causeId}-error` : undefined}
          >
            <SelectValue placeholder="Choose a cause" />
          </SelectTrigger>
          <SelectContent>
            {CAUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {CAUSE_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {causeError ? (
          <FieldError id={`${causeId}-error`}>{causeError}</FieldError>
        ) : (
          cause && <FieldDescription>{HINTS[cause]}</FieldDescription>
        )}
      </Field>
      {cause === "other" && (
        <Field data-invalid={!!directionError}>
          <FieldLabel htmlFor={directionId}>Direction</FieldLabel>
          <Select value={direction} onValueChange={(picked) => onDirection(picked as Direction)}>
            <SelectTrigger
              id={directionId}
              className="w-full"
              aria-invalid={directionError ? true : undefined}
              aria-describedby={directionError ? `${directionId}-error` : undefined}
            >
              <SelectValue placeholder="Add or remove" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="add">Add stock</SelectItem>
              <SelectItem value="remove">Remove stock</SelectItem>
            </SelectContent>
          </Select>
          {directionError && <FieldError id={`${directionId}-error`}>{directionError}</FieldError>}
        </Field>
      )}
    </>
  );
}
