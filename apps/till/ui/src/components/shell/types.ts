export type ShellView =
  | "dashboard"
  | "sale"
  | "inventory"
  | "reports"
  | "purchases"
  | "settings"
  | "shift";
/** A cash movement the shell starts from the Menu or its key; the screen that owns the dialog decides what it needs. */
export type ShellAction = "drop" | "nosale";
export type LinkState = "good" | "pending" | "problem";
export type ShellLink = { label: string; state: LinkState; online: boolean };
