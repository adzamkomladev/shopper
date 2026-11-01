import * as React from "react";
import { cn } from "cn";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "#components/input/group";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "#components/popover";
import type { PickerProps } from "#components/picker/types";

type FieldProps = PickerProps & {
  parse: (text: string) => string | null;
  format: (value: string) => string;
  icon: React.ReactNode;
  /** Names the button that opens the panel, e.g. "Choose a date". */
  openLabel: string;
  /** `choose(value)` sets the value and closes; `choose(value, true)` keeps the panel open. */
  panel: (choose: (value: string, keepOpen?: boolean) => void) => React.ReactNode;
};

/**
 * A typed field with a panel: the value can be keyed in (`2026-11-01`) or picked. The text box holds
 * a draft while it is half typed, and reports only complete values, so the native controls' contract
 * (`fill("2026-11-01")`, ISO strings) holds.
 */
export function PickerField({
  value,
  onValueChange,
  parse,
  format,
  icon,
  openLabel,
  panel,
  className,
  disabled,
  onBlur,
  touch,
  ...input
}: FieldProps) {
  const [open, setOpen] = React.useState(false);
  const group = React.useRef<HTMLDivElement>(null);
  const [draft, setDraft] = React.useState(format(value));
  const [shown, setShown] = React.useState(value);
  // A new value from outside replaces the draft (adjusting state during render, not in an effect).
  if (value !== shown) {
    setShown(value);
    setDraft(format(value));
  }
  const choose = (next: string, keepOpen = false) => {
    if (!keepOpen) setOpen(false);
    setDraft(format(next));
    if (next !== value) onValueChange(next);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <InputGroup
          ref={group}
          data-disabled={disabled || undefined}
          className={cn("bg-transparent", touch && "h-11", className)}
        >
          <InputGroupInput
            {...input}
            disabled={disabled}
            autoComplete="off"
            value={draft}
            onChange={(event) => {
              const text = event.target.value;
              setDraft(text);
              const next = text.trim() === "" ? "" : parse(text);
              if (next !== null && next !== value) onValueChange(next);
            }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowDown" || !event.altKey) return;
              event.preventDefault();
              setOpen(true);
            }}
            onBlur={(event) => {
              // A half-typed value goes back to the last good one.
              if (draft.trim() !== "" && parse(draft) === null) setDraft(format(value));
              onBlur?.(event);
            }}
            className="tabular-nums"
          />
          <InputGroupAddon align="inline-end">
            <PopoverTrigger asChild>
              <InputGroupButton
                size="icon-xs"
                disabled={disabled}
                aria-label={openLabel}
                aria-keyshortcuts="Alt+ArrowDown"
              >
                {icon}
              </InputGroupButton>
            </PopoverTrigger>
          </InputGroupAddon>
        </InputGroup>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-auto p-3"
        // The panel puts focus on the chosen day or time itself.
        onOpenAutoFocus={(event) => event.preventDefault()}
        // Back to the text box, where the cashier was typing, rather than the icon button.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          group.current?.querySelector("input")?.focus();
        }}
      >
        {panel(choose)}
      </PopoverContent>
    </Popover>
  );
}
