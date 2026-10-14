export type Presentation = {
  label: string;
  variant: "secondary" | "outline" | "default";
  /** A pending invitation can be sent again or cancelled; anything else is history. */
  open: boolean;
};
