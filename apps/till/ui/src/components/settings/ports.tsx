import { RefreshCw } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { Field, FieldLabel } from "@shopper/ui/components/field";
import { Skeleton } from "@shopper/ui/components/skeleton";
import type { PortList } from "../../settings/types";
import { SelectField, TextField } from "./field";

/**
 * Picks a port or printer the host can see. While the host looks it shows a skeleton, and when the list
 * is empty or could not be read it falls back to typing the name, so a register is never stuck.
 */
export function PortPicker({
  id,
  label,
  value,
  choices,
  list,
  error,
  disabled,
  note,
  emptyHint,
  onChange,
  onRefresh,
}: {
  id: string;
  label: string;
  value: string;
  /** What the host found, as `[value, label]` pairs. */
  choices: readonly (readonly [string, string])[];
  list: PortList;
  error?: string;
  disabled: boolean;
  /** Always shown under the field. */
  note?: string;
  emptyHint: string;
  onChange: (value: string) => void;
  onRefresh: () => void;
}) {
  const looking = list.status === "loading";
  if (looking && choices.length === 0)
    return (
      <Field className="gap-2" role="status">
        <FieldLabel>{label}</FieldLabel>
        <Skeleton aria-hidden="true" className="h-11 w-full" />
        <span className="sr-only">Looking for {label.toLowerCase()} options</span>
      </Field>
    );
  const typed = choices.length === 0;
  const options =
    !typed && value && !choices.some(([choice]) => choice === value)
      ? [...choices, [value, `${value} · not detected`] as const]
      : choices;
  const hints = [
    list.status === "failed"
      ? "Could not read the list from this register. Type the name or refresh."
      : typed && emptyHint,
    note,
  ].filter((hint): hint is string => !!hint);
  return (
    <div className="flex flex-col gap-1">
      {typed ? (
        <TextField
          error={error}
          id={id}
          label={label}
          onChange={onChange}
          readOnly={disabled}
          value={value}
        />
      ) : (
        <SelectField
          disabled={disabled}
          error={error}
          id={id}
          label={label}
          onChange={onChange}
          options={options}
          placeholder="Choose from the list"
          value={value}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-2">
        <div className="min-w-0 flex-1 text-xs text-muted-foreground">
          {hints.map((hint) => (
            <p key={hint}>{hint}</p>
          ))}
        </div>
        <Button
          aria-keyshortcuts="Alt+N"
          className="ml-auto"
          disabled={disabled || looking}
          onClick={onRefresh}
          size="touch"
          type="button"
          variant="ghost"
        >
          <RefreshCw aria-hidden="true" /> {looking ? "Looking…" : "Refresh list"}{" "}
          <Kbd className="max-sm:hidden">Alt+N</Kbd>
        </Button>
      </div>
    </div>
  );
}
