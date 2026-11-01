import type * as React from "react";

export type PickerProps = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: string;
  /** Called with a complete, valid value, or "" when the field is cleared. */
  onValueChange: (value: string) => void;
  /** 44px tall, for the till. */
  touch?: boolean;
};
